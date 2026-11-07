#!/usr/bin/env python3
import json
import re
import shutil
import sys
from pathlib import Path
from typing import Optional

GREEN = "\033[0;32m"
YELLOW = "\033[1;33m"
RED = "\033[0;31m"
CYAN = "\033[0;36m"
NC = "\033[0m"

KNOWN_EXTENSIONS = (".py", ".json", ".md")
GENERIC_NAMES = {"__init__", "index", "document", "uuid", "vec3", "this", "navigator", "engine"}
ROOT_PREFIXES: tuple[str, ...] = ("src", "app", "lib")


def configure_root_prefixes(root_folders: Optional[list[str]] = None) -> tuple[str, ...]:
    """
    Configura os prefixos base dinamicamente.
    Ordena por tamanho (decrescente) para garantir que 'src/ai' é avaliado antes de 'src'.
    """
    prefixes = ["src", "app", "lib"]
    # Dá prioridade aos folders passados pelo utilizador
    source_folders = list(root_folders or []) + prefixes
    
    seen = set()
    valid_prefixes = []

    for folder in source_folders:
        folder_clean = str(folder).strip().strip("/")
        if not folder_clean:
            continue
        normalized = folder_clean.lower()
        if normalized not in seen:
            valid_prefixes.append(folder_clean)
            seen.add(normalized)

    # ORDENAÇÃO CRÍTICA: Maior string primeiro
    valid_prefixes.sort(key=len, reverse=True)

    global ROOT_PREFIXES
    ROOT_PREFIXES = tuple(valid_prefixes)
    return ROOT_PREFIXES


def _strip_known_prefixes(path_str: str) -> str:
    clean = path_str.strip("/")
    if not clean:
        return ""

    while True:
        stripped = False
        for prefix in ROOT_PREFIXES:
            prefix_norm = prefix.strip("/")
            if not prefix_norm:
                continue
            if clean == prefix_norm or clean.startswith(f"{prefix_norm}/"):
                clean = clean[len(prefix_norm):].lstrip("/")
                stripped = True
                break
        if not stripped:
            break

    return clean.strip("/")


def canonical_key(path_or_import: str) -> str:
    """Normalize any Python import or filesystem path to a canonical graph key."""
    if not path_or_import:
        return ""

    clean = path_or_import.split("#")[0].split("::")[0].strip()
    clean = clean.replace("\\", "/").strip()
    clean = clean.lstrip("./").strip("/")

    # Removemos o hardcode do "src/" daqui pois o _strip_known_prefixes já trata disso dinamicamente
    for prefix in (".KnowledgeGraph/", "KnowledgeGraph/", "site/src/", "site/"):
        if clean == prefix.rstrip("/"):
            return ""
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
            break

    clean = clean.strip("/")

    for ext in KNOWN_EXTENSIONS:
        if clean.endswith(ext):
            clean = clean[:-len(ext)]

    if "/" not in clean and "." in clean and not clean.startswith(("http://", "https://")):
        clean = clean.replace(".", "/")

    if clean.endswith("/__init__") or clean == "__init__":
        clean = clean[:-9] if clean.endswith("/__init__") else ""

    clean = _strip_known_prefixes(clean)
    return clean.strip("/")


def extract_fs_hierarchy(canonical_id: str, is_external: bool = False) -> dict:
    if is_external:
        subsystem = "EXTERNAL"
        return {
            "subsystem": subsystem,
            "subsystem_path": subsystem,
            "path": subsystem,
            "levels": [subsystem],
            "level_1": subsystem,
            "level_2": None,
            "level_3": None,
        }

    clean_id = canonical_id.strip("/")
    if not clean_id:
        subsystem = "CORE"
        return {
            "subsystem": subsystem,
            "subsystem_path": subsystem,
            "path": subsystem,
            "levels": [subsystem],
            "level_1": subsystem,
            "level_2": None,
            "level_3": None,
        }

    # Como o src/ai foi removido no root, "parts" já começa em "core" ou "modules"
    parts = [part for part in clean_id.split("/") if part and part not in {".", "src"}]
    filtered = [part for part in parts if part.lower() not in GENERIC_NAMES]
    
    if not filtered:
        subsystem = "CORE"
    else:
        subsystem = filtered[0].upper()

    return {
        "subsystem": subsystem,
        "subsystem_path": subsystem,
        "path": subsystem,
        "levels": [subsystem],
        "level_1": subsystem,
        "level_2": None,
        "level_3": None,
    }


def _extract_overview_section(content: str) -> str:
    match = re.search(r"## 1\. Overview & Purpose(.*?)(?=\n## 2\.|\Z)", content, re.DOTALL)
    if not match:
        return ""
    lines = [line for line in match.group(1).strip().splitlines() if not line.strip().startswith("|")]
    return "\n".join(lines).strip()


def _extract_side_effects(content: str) -> str:
    match = re.search(
        r"(?is)(?:^|\n)\s*[-*]?\s*\*\*Side Effects:\*\*(.*?)(?=(?:\n\s*[-*]?\s*\*\*|\n## |\Z))",
        content,
    )
    return match.group(1).strip() if match else ""


def extract_markdown_summary(md_path: Optional[Path]) -> dict:
    if not md_path or not md_path.exists():
        return {}
    try:
        content = md_path.read_text(encoding="utf-8")
        return {
            "human_overview": _extract_overview_section(content),
            "side_effects": _extract_side_effects(content),
            "raw_markdown": content,
        }
    except Exception as e:
        print(f"{RED}[Erro no MD]{NC} {md_path.name}: {e}")
        return {}


def _normalize_doc_rel_path(doc_rel_path: str) -> str:
    clean = doc_rel_path.lstrip("/")
    if clean.endswith(".json"):
        clean = f"{clean[:-5]}.md"
    for prefix in (".KnowledgeGraph/", "KnowledgeGraph/"):
        if clean.startswith(prefix):
            clean = clean[len(prefix):]
    return clean


def resolve_md_file(base_d_path: Path, doc_rel_path: str, comp_name: str) -> Optional[Path]:
    if not base_d_path or not base_d_path.exists():
        return None

    clean_path = _normalize_doc_rel_path(doc_rel_path)
    candidates = [base_d_path / clean_path]
    parts = Path(clean_path).parts
    
    if len(parts) > 1:
        candidates.append(base_d_path.joinpath(*parts[1:]))
        
    filename = Path(clean_path).name
    candidates.append(base_d_path / filename)

    for candidate in candidates:
        if candidate.exists():
            return candidate

    comp_slug = re.sub(r"(?<!^)(?=[A-Z])", "_", comp_name).lower()
    search_names = (filename, f"{comp_name}.md", f"{comp_slug}.md")
    
    for search_name in search_names:
        matches = list(base_d_path.glob(f"**/{search_name}"))
        if matches:
            return matches[0]

    print(f"{YELLOW}[Aviso] Ficheiro markdown não encontrado para componente: {comp_name}{NC}")
    return None


def load_graph_data(knowledge_dir: str, docs_dir: str = None, root_paths: list[str] = None) -> dict:
    # Configura dinamicamente os root paths no início da extração
    configure_root_prefixes(root_paths)
    
    base_k_path = Path(knowledge_dir)
    base_d_path = Path(docs_dir) if docs_dir else None

    if not base_k_path.exists():
        print(f"{RED}[!] Diretório '{knowledge_dir}' não encontrado.{NC}")
        return {"nodes": [], "links": []}

    nodes_map = {}
    edges_list = []
    alias_lookup = {}

    json_files = list(base_k_path.glob("**/*.json"))
    print(f"\n{CYAN}=== A PROCESSAR E CANONICALIZAR O GRAFO ==={NC}")
    print(f"[*] Ficheiros JSON brutos: {len(json_files)}")

    for file_path in json_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            comp = data.get("component", {})
            vec = data.get("vector_memory", {})
            metadata = data.get("metadata", {})
            raw_path = comp.get("source_path", str(file_path))
            c_id = canonical_key(raw_path) or canonical_key(file_path.stem)
            comp_name = comp.get("name", Path(c_id).name)
            doc_rel_path = comp.get("doc_path", "")

            alias_lookup[raw_path] = c_id
            alias_lookup[str(file_path)] = c_id
            alias_lookup[c_id.replace("/", ".")] = c_id
            if comp_name:
                alias_lookup[comp_name] = c_id

            md_info = {}
            if base_d_path and doc_rel_path:
                found_md = resolve_md_file(base_d_path, doc_rel_path, comp_name)
                if found_md and found_md.exists():
                    md_info = extract_markdown_summary(found_md)

            node_hierarchy = extract_fs_hierarchy(c_id)

            if c_id not in nodes_map:
                nodes_map[c_id] = {
                    "id": c_id,
                    "name": comp_name or c_id.split("/")[-1],
                    "group": comp.get("type", "module"),
                    "subsystem": node_hierarchy["subsystem"],
                    "subsystem_path": node_hierarchy["subsystem_path"],
                    "level_1": node_hierarchy["level_1"],
                    "level_2": node_hierarchy["level_2"],
                    "level_3": node_hierarchy["level_3"],
                    "semantic_summary": vec.get("semantic_summary", ""),
                    "keywords": vec.get("vector_summary_keywords", []),
                    "human_overview": md_info.get("human_overview", ""),
                    "side_effects": md_info.get("side_effects", ""),
                    "raw_markdown": md_info.get("raw_markdown", ""),
                    "environment_variables": metadata.get("environment_variables", []),
                    "external_dependencies": metadata.get("external_dependencies", [])
                }

            # --- PROCESSA E CRIA NÓS/ARESTAS PARA AS EXTERNAL DEPENDENCIES ---
            for ext_dep in metadata.get("external_dependencies", []):
                if not ext_dep:
                    continue
                # Prefixo para garantir que não colide com ficheiros do projeto
                ext_id = f"@external/{ext_dep}"
                
                if ext_id not in nodes_map:
                    nodes_map[ext_id] = {
                        "id": ext_id,
                        "name": ext_dep,
                        "group": "External/Dependency",
                        "subsystem": "EXTERNAL",
                        "subsystem_path": "EXTERNAL",
                        "level_1": "EXTERNAL",
                        "level_2": None,
                        "level_3": None,
                    }
                
                alias_lookup[ext_id] = ext_id
                edges_list.append({"src": raw_path, "tgt": ext_id, "rel": "depends_on"})
            # ------------------------------------------------------------------

            for sub_node in data.get("graph_nodes", []):
                raw_sub_id = sub_node.get("id")
                sub_c_id = canonical_key(raw_sub_id)
                sub_name = sub_node.get("name")
                
                if raw_sub_id:
                    alias_lookup[raw_sub_id] = sub_c_id
                    if comp_name and sub_name:
                        alias_lookup[f"{c_id}.{sub_name}"] = sub_c_id
                
                if sub_name:
                    alias_lookup[f"{c_id}.{sub_name}"] = sub_c_id
                    alias_lookup[f"{c_id}/{sub_name}"] = sub_c_id

                if sub_c_id not in nodes_map:
                    sub_hierarchy = extract_fs_hierarchy(sub_c_id)
                    nodes_map[sub_c_id] = {
                        "id": sub_c_id,
                        "name": sub_name,
                        "group": sub_node.get("label", "Entity"),
                        "subsystem": sub_hierarchy["subsystem"],
                        "subsystem_path": sub_hierarchy["subsystem_path"],
                        "level_1": sub_hierarchy["level_1"],
                        "level_2": sub_hierarchy["level_2"],
                        "level_3": sub_hierarchy["level_3"],
                        "signature": sub_node.get("signature", ""),
                    }

            for edge in data.get("graph_edges", []):
                src = edge.get("source")
                target = edge.get("target")
                rel = edge.get("relation")
                if src and target:
                    edges_list.append({"src": src, "tgt": target, "rel": rel})

        except Exception as e:
            print(f"{RED}[!] Erro ao processar {file_path.name}:{NC} {e}")

    resolved_links = []
    edges_seen = set()
    for edge in edges_list:
        raw_src = edge["src"]
        raw_tgt = edge["tgt"]
        rel = edge["rel"]

        src_c = alias_lookup.get(raw_src) or canonical_key(raw_src)
        tgt_c = alias_lookup.get(raw_tgt) or canonical_key(raw_tgt)

        if tgt_c not in nodes_map:
            parts = tgt_c.split("/") if tgt_c else []
            if len(parts) > 1:
                parent_c = "/".join(parts[:-1])
                if parent_c in nodes_map:
                    tgt_c = parent_c

        if tgt_c not in nodes_map:
            tgt_name = tgt_c.split("/")[-1] if tgt_c else "External"
            nodes_map[tgt_c] = {
                "id": tgt_c,
                "name": tgt_name,
                "group": "External/Dependency",
                "subsystem": "EXTERNAL",
                "subsystem_path": "EXTERNAL",
                "level_1": "EXTERNAL",
                "level_2": None,
                "level_3": None,
            }

        if src_c and tgt_c and src_c != tgt_c:
            edge_key = (src_c, tgt_c, rel)
            if edge_key not in edges_seen:
                edges_seen.add(edge_key)
                resolved_links.append({"source": src_c, "target": tgt_c, "relation": rel})

    connected_ids = set()
    for link in resolved_links:
        connected_ids.add(link["source"])
        connected_ids.add(link["target"])

    all_nodes = list(nodes_map.values())
    connected_count = sum(1 for node in all_nodes if node["id"] in connected_ids)
    orphan_count = len(all_nodes) - connected_count

    print(f"\n{CYAN}--- ESTATÍSTICAS DE CONECTIVIDADE ---{NC}")
    print(f"Total de nós:           {len(all_nodes)}")
    print(f"{GREEN}Nós conectados:         {connected_count}{NC}")
    print(f"{YELLOW}Nós órfãos (isolados):   {orphan_count}{NC}")
    print(f"Arestas consolidadas:   {len(resolved_links)}")
    print(f"{CYAN}-------------------------------------{NC}\n")

    return {"nodes": all_nodes, "links": resolved_links}


def build_production_bundle(knowledge_dir: str, docs_dir: str, output_dir: str, root_paths: list[str] = None):
    project_root = Path(__file__).resolve().parent.parent
    out_path = Path(output_dir)
    out_path.mkdir(parents=True, exist_ok=True)
    client_dir = project_root / "client"

    print(f"\n{CYAN}=== A COMPILAR PROD BUILD ESTÁTICO ==={NC}")
    # Passamos os root_paths para a extração
    graph_data = load_graph_data(knowledge_dir, docs_dir, root_paths)

    json_dest = out_path / "data.json"
    with open(json_dest, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, ensure_ascii=False)
    print(f"{GREEN}[OK]{NC} Gravado {json_dest}")

    if not client_dir.exists():
        print(f"{RED}[Erro]{NC} diretório client/ não encontrado.")
        sys.exit(1)

    for asset in client_dir.iterdir():
        if asset.is_file():
            shutil.copy2(asset, out_path / asset.name)
            print(f"{GREEN}[OK]{NC} Gravado {out_path / asset.name}")

    print(f"\n{GREEN}✔ Build concluído com sucesso em: {out_path.resolve()}{NC}")