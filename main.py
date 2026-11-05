#!/usr/bin/env python3
import sys
import os
import json
import argparse
import http.server
import socketserver
import webbrowser
from pathlib import Path
import re
import shutil

GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
CYAN = "\033[0;36m"
NC = "\033[0m"

def canonical_key(path_or_import: str) -> str:
    """Transforma qualquer formato de caminho ou import Python numa chave canónica única.
    Exemplos:
      - 'ai.tools' -> 'ai/tools'
      - '/src/ai/tools/__init__.py' -> 'ai/tools'
      - 'src/ai/tools/agent_tools.py' -> 'ai/tools/agent_tools'
      - '.KnowledgeGraph/ai/tools.json' -> 'ai/tools'
    """
    if not path_or_import:
        return ""
    
    # 1. Normalizar separadores e retirar tags de símbolos (#classe, ::func)
    clean = path_or_import.split("#")[0].split("::")[0].strip()
    clean = clean.replace("\\", "/").strip("/")

    # 2. Remover prefixos habituais de raiz e cache
    for prefix in [".KnowledgeGraph/", "KnowledgeGraph/", "src/"]:
        if clean.startswith(prefix):
            clean = clean[len(prefix):]

    # 3. Remover extensões de ficheiro
    for ext in [".py", ".json", ".md"]:
        if clean.endswith(ext):
            clean = clean[:-len(ext)]

    # 4. Converter sintaxe de import Python de pontos para barras (ex: ai.tools -> ai/tools)
    if "/" not in clean and "." in clean:
        clean = clean.replace(".", "/")

    # 5. Se apontar para __init__, normaliza para a pasta pai (ex: ai/tools/__init__ -> ai/tools)
    if clean.endswith("/__init__") or clean == "__init__":
        clean = clean[:-9] if clean.endswith("/__init__") else ""

    return clean.strip("/")

def extract_subsystem_group(canonical_id: str) -> str:
    parts = Path(canonical_id).parts
    if len(parts) >= 2:
        return parts[1].upper() if parts[0] == "ai" else parts[0].upper()
    elif len(parts) == 1 and parts[0]:
        return parts[0].upper()
    return "CORE"

def extract_markdown_summary(md_path: Path) -> dict:
    if not md_path or not md_path.exists():
        return {}
    try:
        content = md_path.read_text(encoding="utf-8")
        overview_text = ""
        sec1_match = re.search(r"## 1\. Overview & Purpose(.*?)(?=\n## 2\.|\Z)", content, re.DOTALL)
        if sec1_match:
            raw_sec1 = sec1_match.group(1).strip()
            cleaned_lines = [l for l in raw_sec1.splitlines() if not l.strip().startswith("|")]
            overview_text = "\n".join(cleaned_lines).strip()
        
        side_effects_text = ""
        side_effects_match = re.search(r"- \*\*Side Effects:\*\*(.*?)(?=\n- \*\*|\n## |\Z)", content, re.DOTALL)
        if side_effects_match:
            side_effects_text = side_effects_match.group(1).strip()

        return {
            "human_overview": overview_text,
            "side_effects": side_effects_text,
            "raw_markdown": content
        }
    except Exception as e:
        print(f"{RED}[Erro no MD]{NC} {md_path.name}: {e}")
        return {}

def resolve_md_file(base_d_path: Path, doc_rel_path: str, comp_name: str) -> Path:
    clean_path = doc_rel_path.lstrip("/")
    if clean_path.endswith(".json"):
        clean_path = clean_path[:-5] + ".md"

    for prefix in [".KnowledgeGraph/", "KnowledgeGraph/"]:
        if clean_path.startswith(prefix):
            clean_path = clean_path[len(prefix):]

    attempt_1 = base_d_path / clean_path
    if attempt_1.exists():
        return attempt_1
    
    parts = Path(clean_path).parts
    if len(parts) > 1:
        attempt_2 = base_d_path.joinpath(*parts[1:])
        if attempt_2.exists():
            return attempt_2

    filename = Path(clean_path).name
    attempt_3 = base_d_path / filename
    if attempt_3.exists():
        return attempt_3

    matches = list(base_d_path.glob(f"**/{filename}"))
    if matches:
        return matches[0]

    comp_slug = re.sub(r'(?<!^)(?=[A-Z])', '_', comp_name).lower()
    for candidate in [f"{comp_name}.md", f"{comp_slug}.md"]:
        comp_matches = list(base_d_path.glob(f"**/{candidate}"))
        if comp_matches:
            return comp_matches[0]

    return None

def load_graph_data(knowledge_dir: str, docs_dir: str = None) -> dict:
    base_k_path = Path(knowledge_dir)
    base_d_path = Path(docs_dir) if docs_dir else None

    if not base_k_path.exists():
        print(f"{RED}[!] Diretório '{knowledge_dir}' não encontrado.{NC}")
        return {"nodes": [], "links": []}

    nodes_map = {}
    edges_list = []
    alias_lookup = {}  # Mapeia qualquer alias ou variação para o ID canónico

    json_files = list(base_k_path.glob("**/*.json"))
    print(f"\n{CYAN}=== A PROCESSAR E CANONICALIZAR O GRAFO ==={NC}")
    print(f"[*] Ficheiros JSON brutos: {len(json_files)}")

    # PASSO 1: Registar todos os nós reais a partir dos JSONs
    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            comp = data.get("component", {})
            vec = data.get("vector_memory", {})

            raw_path = comp.get("source_path", str(file_path))
            c_id = canonical_key(raw_path)
            if not c_id:
                c_id = canonical_key(file_path.stem)

            comp_name = comp.get("name", Path(c_id).name)
            doc_rel_path = comp.get("doc_path", "")

            # Guardar aliases conhecidos
            alias_lookup[raw_path] = c_id
            alias_lookup[str(file_path)] = c_id
            alias_lookup[c_id.replace("/", ".")] = c_id  # Formato python import
            if comp_name:
                alias_lookup[comp_name] = c_id

            md_info = {}
            if base_d_path and doc_rel_path:
                found_md = resolve_md_file(base_d_path, doc_rel_path, comp_name)
                if found_md and found_md.exists():
                    md_info = extract_markdown_summary(found_md)

            subsystem = extract_subsystem_group(c_id)

            if c_id not in nodes_map:
                nodes_map[c_id] = {
                    "id": c_id,
                    "name": comp_name or c_id.split("/")[-1],
                    "group": comp.get("type", "module"),
                    "subsystem": subsystem,
                    "semantic_summary": vec.get("semantic_summary", ""),
                    "keywords": vec.get("vector_summary_keywords", []),
                    "human_overview": md_info.get("human_overview", ""),
                    "side_effects": md_info.get("side_effects", ""),
                    "raw_markdown": md_info.get("raw_markdown", "")
                }

            # Sub-nós (classes, funções declaradas dentro do ficheiro)
            for sub_node in data.get("graph_nodes", []):
                raw_sub_id = sub_node.get("id")
                sub_c_id = canonical_key(raw_sub_id)
                alias_lookup[raw_sub_id] = sub_c_id
                
                sub_name = sub_node.get("name")
                if sub_name:
                    alias_lookup[f"{c_id}.{sub_name}"] = sub_c_id
                    alias_lookup[f"{c_id}/{sub_name}"] = sub_c_id

                if sub_c_id not in nodes_map:
                    nodes_map[sub_c_id] = {
                        "id": sub_c_id,
                        "name": sub_name,
                        "group": sub_node.get("label", "Entity"),
                        "subsystem": subsystem,
                        "signature": sub_node.get("signature", "")
                    }

            # Acumular arestas em bruto
            for edge in data.get("graph_edges", []):
                src = edge.get("source")
                tgt = edge.get("target")
                rel = edge.get("relation")
                if src and tgt:
                    edges_list.append({"src": src, "tgt": tgt, "rel": rel})

        except Exception as e:
            print(f"{RED}[!] Erro ao processar {file_path.name}:{NC} {e}")

    # PASSO 2: Normalizar e resolver todas as arestas contra o mapa de nós
    resolved_links = []
    edges_seen = set()

    for edge in edges_list:
        raw_src = edge["src"]
        raw_tgt = edge["tgt"]
        rel = edge["rel"]

        # Resolver Source
        src_c = alias_lookup.get(raw_src) or canonical_key(raw_src)
        # Resolver Target
        tgt_c = alias_lookup.get(raw_tgt) or canonical_key(raw_tgt)

        # Se o target direto não foi encontrado, tenta resolução parcial por módulo pai
        if tgt_c not in nodes_map:
            # Testa se faz parte de um nó existente (ex: ai/tools/mcp_bridge -> ai/tools)
            parts = tgt_c.split("/")
            if len(parts) > 1:
                parent_c = "/".join(parts[:-1])
                if parent_c in nodes_map:
                    tgt_c = parent_c

        # Se mesmo assim o target for externo, regista-o de forma canónica
        if tgt_c not in nodes_map:
            tgt_name = tgt_c.split("/")[-1] if "/" in tgt_c else tgt_c
            nodes_map[tgt_c] = {
                "id": tgt_c,
                "name": tgt_name,
                "group": "External/Dependency",
                "subsystem": extract_subsystem_group(tgt_c)
            }

        if src_c and tgt_c and src_c != tgt_c:
            edge_key = (src_c, tgt_c, rel)
            if edge_key not in edges_seen:
                edges_seen.add(edge_key)
                resolved_links.append({
                    "source": src_c,
                    "target": tgt_c,
                    "relation": rel
                })

    # PASSO 3: Auditoria de conectividade e contagem de órfãos
    connected_ids = set()
    for link in resolved_links:
        connected_ids.add(link["source"])
        connected_ids.add(link["target"])

    all_nodes = list(nodes_map.values())
    connected_count = sum(1 for n in all_nodes if n["id"] in connected_ids)
    orphan_count = len(all_nodes) - connected_count

    print(f"\n{CYAN}--- ESTATÍSTICAS DE CONECTIVIDADE ---{NC}")
    print(f"Total de nós:           {len(all_nodes)}")
    print(f"{GREEN}Nós conectados:         {connected_count}{NC}")
    print(f"{YELLOW}Nós órfãos (isolados):   {orphan_count}{NC}")
    print(f"Arestas consolidadas:   {len(resolved_links)}")
    print(f"{CYAN}-------------------------------------{NC}\n")

    return {"nodes": all_nodes, "links": resolved_links}

def build_production_bundle(knowledge_dir: str, docs_dir: str, output_dir: str):
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    print(f"\n{CYAN}=== A COMPILAR PROD BUILD ESTÁTICO ==={NC}")
    graph_data = load_graph_data(knowledge_dir, docs_dir)

    json_dest = out_path / "data.json"
    with open(json_dest, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, ensure_ascii=False)
    print(f"{GREEN}[OK]{NC} Gravado {json_dest}")

    src_html = Path(__file__).parent / "index.html"
    if not src_html.exists():
        print(f"{RED}[Erro]{NC} index.html não encontrado.")
        sys.exit(1)

    dst_html = out_path / "index.html"
    shutil.copy(src_html, dst_html)
    print(f"{GREEN}[OK]{NC} Gravado {dst_html}")
    print(f"\n{GREEN}✔ Build concluído com sucesso em: {out_path.resolve()}{NC}")

class VisualizerHandler(http.server.SimpleHTTPRequestHandler):
    knowledge_dir = "."
    docs_dir = None

    def do_GET(self):
        if self.path in ('/', '/index.html'):
            self.send_response(200)
            self.send_header("Content-type", "text/html; charset=utf-8")
            self.end_headers()
            
            html_file = Path(__file__).parent / "index.html"
            if html_file.exists():
                self.wfile.write(html_file.read_bytes())
            else:
                self.wfile.write(b"<h1>index.html not found!</h1>")
        elif self.path in ('/api/data', '/data.json'):
            self.send_response(200)
            self.send_header("Content-type", "application/json; charset=utf-8")
            self.end_headers()
            
            graph_data = load_graph_data(self.knowledge_dir, self.docs_dir)
            self.wfile.write(json.dumps(graph_data).encode("utf-8"))
        else:
            super().do_GET()

def parse_arguments():
    parser = argparse.ArgumentParser(
        description="Visualizador 3D de Knowledge Graphs e Memória Semântica."
    )
    parser.add_argument("-k", "--knowledge", dest="knowledge_dir", required=True)
    parser.add_argument("-d", "--docs", dest="docs_dir", default=None)
    parser.add_argument("-p", "--port", dest="port", type=int, default=8080)
    parser.add_argument("-b", "--build", dest="build_dir", nargs="?", const="./dist", default=None)
    return parser.parse_args()

def main():
    args = parse_arguments()

    if not os.path.exists(args.knowledge_dir):
        print(f"{RED}[Erro] Diretoria não existe: {args.knowledge_dir}{NC}")
        sys.exit(1)

    if args.build_dir:
        build_production_bundle(args.knowledge_dir, args.docs_dir, args.build_dir)
        sys.exit(0)

    VisualizerHandler.knowledge_dir = args.knowledge_dir
    VisualizerHandler.docs_dir = args.docs_dir

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", args.port), VisualizerHandler) as httpd:
        url = f"http://localhost:{args.port}"
        print(f"[*] Visualizador 3D ativo em: {url}")
        webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print(f"\n[*] Servidor encerrado.")

if __name__ == "__main__":
    main()