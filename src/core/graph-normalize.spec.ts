import { describe, it, expect } from 'vitest';
import { countConnections, createNodeResolver, normalizeGraphData, DOC_RELATION } from './graph-normalize';
import { GraphData } from './graph.model';

const docMd = (internal: string) =>
  `## 4. Dependencies & Configuration\n**Module Dependencies:**\n- **Standard/External:** \`rxjs\`\n- **Internal:** ${internal}\n`;

function fixture(): GraphData {
  return {
    nodes: [
      { id: 'editor/editor.ts', name: 'Editor', group: 'class', raw_markdown: docMd(
        '[EditorService](/src/app/editor/services/editor.service.md), [AuthService](/app/api/services/auth.service.md), [Missing](/nowhere/missing.md)'
      ) },
      { id: 'editor/services/editor.service.ts', name: 'EditorService', group: 'service', raw_markdown: '# doc' },
      // placeholder twin created by the loader for an import target
      { id: 'editor/services/editor.service', name: 'editor.service', group: 'External/Dependency' },
      { id: 'api/services/auth.service.ts', name: 'AuthService', group: 'service' },
      { id: 'guards/auth.guard.ts', name: 'AuthGuard', group: 'class' }
    ],
    links: [
      { source: 'guards/auth.guard.ts', target: 'editor/services/editor.service', relation: 'imports' },
      { source: 'guards/auth.guard.ts', target: 'editor/services/editor.service.ts', relation: 'imports' }
    ]
  };
}

describe('normalizeGraphData', () => {
  it('merges placeholder twins into the real .ts node and dedupes their links', () => {
    const data = fixture();
    const report = normalizeGraphData(data);

    expect(report.mergedDuplicates).toBe(1);
    expect(data.nodes.find(n => n.id === 'editor/services/editor.service')).toBeUndefined();
    const imports = data.links.filter(l => l.relation === 'imports');
    expect(imports).toEqual([
      { source: 'guards/auth.guard.ts', target: 'editor/services/editor.service.ts', relation: 'imports' }
    ]);
  });

  it('adds markdown Internal dependencies as inferred "uses" links and reports unresolved refs', () => {
    const data = fixture();
    const report = normalizeGraphData(data);

    const uses = data.links.filter(l => l.relation === DOC_RELATION);
    expect(uses.map(l => l.target).sort()).toEqual(['api/services/auth.service.ts', 'editor/services/editor.service.ts']);
    expect(uses.every(l => l.source === 'editor/editor.ts' && l.inferred)).toBe(true);
    expect(report.addedDocLinks).toBe(2);
    expect(report.unresolvedDocRefs).toEqual(['editor/editor.ts → /nowhere/missing.md']);
  });

  it('does not add a doc link when the pair is already connected', () => {
    const data = fixture();
    data.links.push({ source: 'editor/services/editor.service.ts', target: 'editor/editor.ts', relation: 'calls' });
    normalizeGraphData(data);
    expect(data.links.some(l => l.relation === DOC_RELATION && l.target === 'editor/services/editor.service.ts')).toBe(false);
  });
});

describe('countConnections', () => {
  it('counts links on both ends', () => {
    const data = fixture();
    normalizeGraphData(data);
    countConnections(data);
    const byId = Object.fromEntries(data.nodes.map(n => [n.id, n.connectionCount]));
    expect(byId['editor/services/editor.service.ts']).toBe(2); // import from guard + uses from editor
    expect(byId['editor/editor.ts']).toBe(2);
  });
});

describe('createNodeResolver', () => {
  const resolve = createNodeResolver(fixture().nodes);

  it('resolves by path, by suffix, and by name', () => {
    expect(resolve('x', '/src/app/editor/services/editor.service.md')?.id).toBe('editor/services/editor.service.ts');
    expect(resolve('x', '/services/auth.service.md')?.id).toBe('api/services/auth.service.ts');
    expect(resolve('AuthGuard', '/unknown/path.md')?.id).toBe('guards/auth.guard.ts');
  });

  it('trusts the link text when it disagrees with a wrong path', () => {
    expect(resolve('AuthService', '/editor/editor.md')?.id).toBe('api/services/auth.service.ts');
  });

  it('returns null for unknown refs', () => {
    expect(resolve('Nope', '/nowhere/missing.md')).toBeNull();
  });
});
