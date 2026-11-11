import { GraphData, GraphLink, GraphNode } from './graph.model';

/** Relation used for dependencies that only appear in a node's markdown docs. */
export const DOC_RELATION = 'uses';

const PLACEHOLDER_GROUP = 'External/Dependency';
const SOURCE_EXTENSIONS = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ROOT_PREFIXES = ['src/', 'app/'];

export interface NormalizeReport {
  mergedDuplicates: number;
  addedDocLinks: number;
  unresolvedDocRefs: string[];
}

const linkEnd = (end: string | GraphNode): string => (typeof end === 'object' ? end.id : end);

const isPlaceholder = (n: GraphNode): boolean => n.group === PLACEHOLDER_GROUP && !n.raw_markdown;

/** `/src/app/editor/foo.service.md` → `editor/foo.service` */
function normalizeRef(ref: string): string {
  let clean = ref.trim().replace(/^\.?\/+/, '').replace(/\.md$/, '').replace(SOURCE_EXTENSIONS, '');
  let stripped = true;
  while (stripped) {
    stripped = false;
    for (const prefix of ROOT_PREFIXES) {
      if (clean.startsWith(prefix)) {
        clean = clean.slice(prefix.length);
        stripped = true;
      }
    }
  }
  return clean;
}

/**
 * Builds a resolver that maps a markdown link (`[Label](/src/app/x/y.service.md)`)
 * to a graph node: exact path, then unique path-suffix match, then unique node name.
 * Real (documented) nodes win over loader placeholders. Returns null when ambiguous/unknown.
 */
export function createNodeResolver(nodes: GraphNode[]): (label: string, href: string) => GraphNode | null {
  const keyed = nodes.map(n => ({ node: n, key: normalizeRef(n.id) }));
  const keyIndex = new Map<string, GraphNode[]>();
  const nameIndex = new Map<string, GraphNode[]>();
  const push = (m: Map<string, GraphNode[]>, k: string, n: GraphNode) => m.set(k, [...(m.get(k) || []), n]);
  keyed.forEach(({ node, key }) => {
    push(keyIndex, key, node);
    if (node.name) push(nameIndex, node.name.toLowerCase(), node);
  });

  const pick = (cands: GraphNode[] | undefined): GraphNode | null => {
    if (!cands || !cands.length) return null;
    const real = cands.filter(c => !isPlaceholder(c));
    if (real.length === 1) return real[0];
    return cands.length === 1 ? cands[0] : null;
  };

  const byPath = (href: string): GraphNode | null => {
    const key = normalizeRef(href.split('#')[0]);
    if (!key) return null;
    return (
      pick(keyIndex.get(key)) ||
      pick(keyed.filter(k => k.key.endsWith('/' + key) || key.endsWith('/' + k.key)).map(k => k.node))
    );
  };

  return (label: string, href: string) => {
    const pathHit = byPath(href);
    const nameHit = label ? pick(nameIndex.get(label.trim().toLowerCase())) : null;
    // Generated docs sometimes point a link at the wrong file (e.g. [EditorService](/editor/editor.md)).
    // When the link text names exactly one node and disagrees with the path, trust the text.
    if (nameHit && pathHit && nameHit !== pathHit) return nameHit;
    return pathHit || nameHit;
  };
}

/** Path segments of a doc link, e.g. `/src/app/editor/inspectors/x.md` → ['editor', 'inspectors', 'x']. */
export function refSegments(href: string): string[] {
  return normalizeRef(href.split('#')[0]).split('/').filter(Boolean);
}

/**
 * Cleans the graph produced by the loader:
 *  1. Merges `path` placeholder nodes into their real `path.ts` node (the loader keeps
 *     `.ts` on file ids but not on import targets, so each imported file appears twice).
 *  2. Adds the "Internal" module dependencies listed in each node's markdown that are
 *     missing from `links`, as `uses` relations flagged `inferred: true`.
 *  3. Drops self-links and duplicate links created by the merge.
 * Mutates and returns `data`.
 */
export function normalizeGraphData(data: GraphData): NormalizeReport {
  const report: NormalizeReport = { mergedDuplicates: 0, addedDocLinks: 0, unresolvedDocRefs: [] };

  // --- 1. merge duplicates ------------------------------------------------
  const byId = new Map(data.nodes.map(n => [n.id, n]));
  const remap = new Map<string, string>();

  data.nodes.forEach(real => {
    if (!SOURCE_EXTENSIONS.test(real.id)) return;
    const bareId = real.id.replace(SOURCE_EXTENSIONS, '');
    const twin = byId.get(bareId);
    if (twin && twin !== real && isPlaceholder(twin)) remap.set(bareId, real.id);
  });

  if (remap.size) {
    data.nodes = data.nodes.filter(n => !remap.has(n.id));
    data.links.forEach(l => {
      const s = linkEnd(l.source);
      const t = linkEnd(l.target);
      if (remap.has(s)) l.source = remap.get(s)!;
      if (remap.has(t)) l.target = remap.get(t)!;
    });
    report.mergedDuplicates = remap.size;
  }

  // --- 2. doc-declared internal dependencies ------------------------------
  const nodes = data.nodes;
  const resolve = createNodeResolver(nodes);

  const existingPairs = new Set<string>();
  data.links.forEach(l => {
    const s = linkEnd(l.source);
    const t = linkEnd(l.target);
    existingPairs.add(`${s}->${t}`);
    existingPairs.add(`${t}->${s}`);
  });

  nodes.forEach(node => {
    const md = node.raw_markdown;
    if (!md) return;
    const section = /\*\*Internal:\*\*([\s\S]*?)(?:\n\s*\n|\n\s*[-*]?\s*\*\*|\n#|$)/.exec(md);
    if (!section) return;

    for (const [, label, href] of section[1].matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
      const target = resolve(label, href);
      if (!target) {
        report.unresolvedDocRefs.push(`${node.id} → ${href}`);
        continue;
      }
      if (target.id === node.id || existingPairs.has(`${node.id}->${target.id}`)) continue;
      data.links.push({ source: node.id, target: target.id, relation: DOC_RELATION, inferred: true });
      existingPairs.add(`${node.id}->${target.id}`);
      existingPairs.add(`${target.id}->${node.id}`);
      report.addedDocLinks++;
    }
  });

  // --- 3. drop self-links and duplicates ----------------------------------
  const seen = new Set<string>();
  data.links = data.links.filter((l: GraphLink) => {
    const s = linkEnd(l.source);
    const t = linkEnd(l.target);
    const key = `${s}|${t}|${l.relation}`;
    if (s === t || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return report;
}

/** Recomputes `connectionCount` on every node from the current links. */
export function countConnections(data: GraphData): void {
  const counts = new Map<string, number>();
  data.links.forEach(l => {
    const s = linkEnd(l.source);
    const t = linkEnd(l.target);
    counts.set(s, (counts.get(s) || 0) + 1);
    counts.set(t, (counts.get(t) || 0) + 1);
  });
  data.nodes.forEach(n => (n.connectionCount = counts.get(n.id) || 0));
}
