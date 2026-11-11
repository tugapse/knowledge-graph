import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { GraphStateService, NeighborRelation } from '../../services/graph-state.service';
import { GraphHierarchyService } from '../../services/graph-hierarchy.service';
import { DEFAULT_GRAPH_CONFIG } from '../../core/graph.config';
import { GraphNode, ClusterGroup } from '../../core/graph.model';
import { GraphStyleService, LinkTypeKey } from '../../services/graph-style.service';
import { createNodeResolver, refSegments } from '../../core/graph-normalize';

import * as marked from 'marked';

const PANEL_WIDTH_KEY = 'kg.inspector.width';
const COLLAPSED_SECTIONS_KEY = 'kg.inspector.collapsed';
const HIDDEN_RELATIONS_KEY = 'kg.inspector.hiddenRelations';
const SHOW_EXTERNAL_KEY = 'kg.inspector.showExternal';
/** Strongest coupling first; unknown relation types sort after these. */
const RELATION_ORDER = ['extends', 'inherits', 'calls', 'imports', 'depends_on', 'uses'];
const DEFAULT_PANEL_WIDTH = 640;
const MIN_PANEL_WIDTH = 420;
const MAX_PANEL_WIDTH = 1100;

@Component({
  selector: 'app-graph-inspector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graph-inspector.html',
  styleUrl: './graph-inspector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphInspectorComponent implements OnInit, OnDestroy {
  activeTab: 'specs' | 'docs' = 'specs';
  panelTitle = 'COMPONENT INSPECTOR';
  isCollapsed = false;
  canGoBack = false;
  panelWidth = this.initialWidth();

  focusedNode: GraphNode | null = null;
  focusedCluster: string | null = null;
  clusterGroups: Record<string, ClusterGroup> = {};
  activeClusterGroup: ClusterGroup | null = null;
  childClusters: string[] = [];

  breadcrumbs: { name: string; path: string }[] = [];
  historyStack: string[] = [];
  semiHighlightCount = 0;
  parentClusterName = '';
  activeNeighbors: NeighborRelation[] = [];
  /** Rendered markdown docs, with links annotated to point at graph nodes/clusters. */
  docsHtml: SafeHtml | string = '';

  private resolverNodes: GraphNode[] | null = null;
  private nodeResolver: ReturnType<typeof createNodeResolver> | null = null;

  collapsedSections = new Set<string>(this.readCollapsedSections());

  /** Filtered + ordered relation lists shown in SPECS. */
  outgoing: NeighborRelation[] = [];
  incoming: NeighborRelation[] = [];
  outgoingTotal = 0;
  incomingTotal = 0;

  /** Relation types present on the selected node, for the filter chips. */
  relationTypes: { relation: string; count: number }[] = [];
  externalCount = 0;
  hiddenRelations = new Set<string>(this.readStoredList(HIDDEN_RELATIONS_KEY));
  showExternal = this.readStoredFlag(SHOW_EXTERNAL_KEY, true);

  private readonly legendDefs: { label: string; key: LinkTypeKey }[] = [
    { label: 'IMPORTS', key: 'imports' },
    { label: 'CALLS / EXTENDS', key: 'calls' },
    { label: 'INHERITS / DEPENDS_ON', key: 'inherits' },
    { label: 'USES (FROM DOCS)', key: 'uses' },
    { label: 'DEFAULT / OTHER', key: 'default' }
  ];

  get legendItems() {
    return this.legendDefs.map(d => ({ label: d.label, color: this.styleService.linkColor(d.key) }));
  }

  private subscriptions = new Subscription();

  constructor(
    private state: GraphStateService,
    private hierarchy: GraphHierarchyService,
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private styleService: GraphStyleService
  ) {}

  ngOnInit(): void {
    console.log('GraphInspectorComponent initialized');
    this.subscriptions.add(
      this.state.clusterGroups$.subscribe(groups => {
        this.clusterGroups = groups;
        this.updateClusterView();
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.state.focusedNode$.subscribe(node => {
        this.focusedNode = node;
        if (node) this.isCollapsed = false; // a new selection always reveals the panel
        this.updateNodeView();
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.state.focusedCluster$.subscribe(cluster => {
        this.focusedCluster = cluster;
        if (cluster) {
          this.isCollapsed = false;
          this.activeTab = 'specs'; // clusters have no docs
        }
        this.updateClusterView();
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.state.semiHighlightNodes$.subscribe(set => {
        this.semiHighlightCount = set.size;
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.state.activeNeighbors$.subscribe(neighbors => {
        this.activeNeighbors = neighbors;
        this.relationTypes = this.countRelationTypes(neighbors);
        this.applyRelationFilters();
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onFocusCluster(clusterName: string): void {
    this.state.selectCluster(
      clusterName,
      DEFAULT_GRAPH_CONFIG.camera.badgeYOffset,
      DEFAULT_GRAPH_CONFIG.camera.baseDistance,
      DEFAULT_GRAPH_CONFIG.camera.distanceScale
    );
  }

  onFocusNode(nodeId: string): void {
    const nodes = this.state.graphData?.nodes || [];
    const node =
      nodes.find(n => n.id === nodeId) ||
      this.getResolver()?.('', nodeId) ||
      null;
    if (!node) return;

    if (this.focusedNode && this.focusedNode.id !== node.id) {
      this.historyStack.push(this.focusedNode.id);
    }
    this.state.selectNode(node);
    this.canGoBack = this.historyStack.length > 0;
  }

  /** Doc links were annotated in renderDocs(); route them to a node or cluster. */
  @HostListener('click', ['$event'])
  onMarkdownClick(event: MouseEvent): void {
    const anchor = (event.target as HTMLElement).closest('.markdown-rendered a') as HTMLAnchorElement | null;
    if (!anchor) return;

    const { kgNode, kgCluster, kgKind } = anchor.dataset;
    if (kgKind === 'external' || kgKind === 'anchor') return; // let the browser handle it

    event.preventDefault();
    event.stopPropagation();
    if (kgNode) this.onFocusNode(kgNode);
    else if (kgCluster) {
      if (this.focusedNode) this.historyStack.push(this.focusedNode.id);
      this.canGoBack = this.historyStack.length > 0;
      this.onFocusCluster(kgCluster);
    }
  }

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    const onMouseMove = (moveEvent: MouseEvent) => {
      // Calculate width based on mouse position relative to the right edge (24px margin)
      this.panelWidth = this.clampWidth(window.innerWidth - moveEvent.clientX - 24);
      this.cdr.markForCheck();
    };
    const onMouseUp = () => {
      try {
        localStorage.setItem(PANEL_WIDTH_KEY, String(this.panelWidth));
      } catch {
        /* storage unavailable */
      }
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  onBack(): void {
    const prevId = this.historyStack.pop();
    if (prevId) {
      const node = this.state.graphData?.nodes.find(n => n.id === prevId);
      if (node) {
        this.state.selectNode(node);
      }
    }
    this.canGoBack = this.historyStack.length > 0;
  }

  getLinkRgb(relation: string): string {
    const c = this.hierarchy.getLinkBaseColor({ source: '', target: '', relation });
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
  }

  isRelationShown(relation: string): boolean {
    return !this.hiddenRelations.has(relation);
  }

  toggleRelation(relation: string): void {
    this.hiddenRelations.has(relation) ? this.hiddenRelations.delete(relation) : this.hiddenRelations.add(relation);
    this.store(HIDDEN_RELATIONS_KEY, [...this.hiddenRelations]);
    this.applyRelationFilters();
  }

  toggleExternal(): void {
    this.showExternal = !this.showExternal;
    this.store(SHOW_EXTERNAL_KEY, this.showExternal);
    this.applyRelationFilters();
  }

  showAllRelations(): void {
    this.hiddenRelations.clear();
    this.showExternal = true;
    this.store(HIDDEN_RELATIONS_KEY, []);
    this.store(SHOW_EXTERNAL_KEY, true);
    this.applyRelationFilters();
  }

  get hasActiveRelationFilter(): boolean {
    return !this.showExternal || this.relationTypes.some(t => this.hiddenRelations.has(t.relation));
  }

  /**
   * Order: project nodes before external packages, then by relation type
   * (strongest coupling first), then alphabetically.
   */
  private applyRelationFilters(): void {
    const rank = (r: string) => {
      const i = RELATION_ORDER.indexOf(r);
      return i === -1 ? RELATION_ORDER.length : i;
    };
    const order = (a: NeighborRelation, b: NeighborRelation) =>
      Number(this.isExternal(a)) - Number(this.isExternal(b)) ||
      rank(a.relation) - rank(b.relation) ||
      a.relation.localeCompare(b.relation) ||
      a.name.localeCompare(b.name);
    const visible = (n: NeighborRelation) =>
      !this.hiddenRelations.has(n.relation) && (this.showExternal || !this.isExternal(n));

    const out = this.activeNeighbors.filter(n => n.dir === 'OUT');
    const inc = this.activeNeighbors.filter(n => n.dir === 'IN');
    this.outgoingTotal = out.length;
    this.incomingTotal = inc.length;
    this.outgoing = out.filter(visible).sort(order);
    this.incoming = inc.filter(visible).sort(order);
  }

  private countRelationTypes(neighbors: NeighborRelation[]): { relation: string; count: number }[] {
    const counts = new Map<string, number>();
    neighbors.forEach(n => counts.set(n.relation, (counts.get(n.relation) || 0) + 1));
    this.externalCount = neighbors.filter(n => this.isExternal(n)).length;
    const rank = (r: string) => (RELATION_ORDER.indexOf(r) + RELATION_ORDER.length + 1) % (RELATION_ORDER.length + 1);
    return [...counts.entries()]
      .map(([relation, count]) => ({ relation, count }))
      .sort((a, b) => rank(a.relation) - rank(b.relation) || a.relation.localeCompare(b.relation));
  }

  private readStoredList(key: string): string[] {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private readStoredFlag(key: string, fallback: boolean): boolean {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === 'true';
    } catch {
      return fallback;
    }
  }

  private store(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }

  isSectionCollapsed(key: string): boolean {
    return this.collapsedSections.has(key);
  }

  /** Collapse state is kept per section (not per node) and remembered in this browser. */
  toggleSection(key: string): void {
    this.collapsedSections.has(key) ? this.collapsedSections.delete(key) : this.collapsedSections.add(key);
    try {
      localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...this.collapsedSections]));
    } catch {
      /* storage unavailable */
    }
  }

  isExternal(n: NeighborRelation): boolean {
    return n.id.startsWith('@external/') || n.group === 'External/Dependency';
  }

  getShortKey(path: string): string {
    return path.split(' / ').pop() || path;
  }

  private updateNodeView(): void {
    if (!this.focusedNode) {
      if (!this.focusedCluster) {
        this.panelTitle = 'COMPONENT INSPECTOR';
      }
      this.breadcrumbs = [];
      this.docsHtml = '';
      return;
    }

    this.panelTitle = this.focusedNode.name || 'COMPONENT';
    const levels = this.focusedNode._levels || [this.focusedNode.subsystem || 'CORE'];
    this.breadcrumbs = levels.map((lvlName, idx) => ({
      name: lvlName,
      path: levels.slice(0, idx + 1).join(' / ')
    }));
    this.parentClusterName = levels.length > 1 ? levels.slice(0, -1).join(' / ') : levels[0];

    this.renderDocs(this.focusedNode);
  }

  private renderDocs(node: GraphNode): void {
    if (!node.raw_markdown) {
      this.docsHtml = '';
      return;
    }
    Promise.resolve(marked.parse(node.raw_markdown))
      .then((html: string) => {
        if (this.focusedNode !== node) return; // selection changed while parsing
        this.docsHtml = this.sanitizer.bypassSecurityTrustHtml(this.annotateDocLinks(html));
        this.cdr.markForCheck();
      })
      .catch(() => (this.docsHtml = ''));
  }

  /**
   * Strips active content from the rendered markdown and tags every link with what it
   * points at in the graph: a node, a cluster (when the file itself isn't a node), an
   * external URL, or nothing (rendered as a muted "missing" link).
   */
  private annotateDocLinks(html: string): string {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstElementChild as HTMLElement;

    root.querySelectorAll('script, iframe, object, embed, style').forEach(el => el.remove());
    root.querySelectorAll('*').forEach(el =>
      [...el.attributes].forEach(a => {
        if (/^on/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      })
    );

    root.querySelectorAll('a[href]').forEach(el => {
      const a = el as HTMLAnchorElement;
      const href = a.getAttribute('href') || '';
      const label = a.textContent || '';

      if (/^(https?:|mailto:)/i.test(href)) {
        a.dataset['kgKind'] = 'external';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.classList.add('kg-link-external');
        return;
      }
      if (href.startsWith('#')) {
        a.dataset['kgKind'] = 'anchor';
        return;
      }

      let node = this.getResolver()?.(label, href) ?? null;
      // A link back to the node being viewed, under a different name, is a bad href in the docs.
      if (node && node === this.focusedNode && label.trim().toLowerCase() !== (node.name || '').toLowerCase()) {
        node = null;
      }
      if (node) {
        a.dataset['kgKind'] = 'node';
        a.dataset['kgNode'] = node.id;
        a.title = `Open ${node.name || node.id}`;
        a.classList.add('kg-link-node');
        return;
      }

      const cluster = this.resolveCluster(href);
      if (cluster) {
        a.dataset['kgKind'] = 'cluster';
        a.dataset['kgCluster'] = cluster;
        a.title = `Not a node in the graph — focus cluster ${cluster}`;
        a.classList.add('kg-link-cluster');
        return;
      }

      a.dataset['kgKind'] = 'missing';
      a.title = 'Not in the graph';
      a.classList.add('kg-link-missing');
    });

    return root.innerHTML;
  }

  private getResolver(): ReturnType<typeof createNodeResolver> | null {
    const nodes = this.state.graphData?.nodes;
    if (!nodes) return null;
    if (nodes !== this.resolverNodes) {
      this.resolverNodes = nodes;
      this.nodeResolver = createNodeResolver(nodes);
    }
    return this.nodeResolver;
  }

  /** Deepest cluster whose path segments all appear (in order) in the link path. */
  private resolveCluster(href: string): string | null {
    const segs = refSegments(href).map(s => s.toLowerCase());
    if (!segs.length) return null;

    let best: { key: string; level: number } | null = null;
    for (const [key, grp] of Object.entries(this.clusterGroups)) {
      const parts = key.split(' / ').map(p => p.toLowerCase());
      let i = 0;
      for (const seg of segs) if (seg === parts[i]) i++;
      if (i === parts.length && (!best || parts.length > best.level)) {
        best = { key, level: parts.length };
      }
    }
    return best?.key ?? null;
  }

  private readCollapsedSections(): string[] {
    try {
      const saved = JSON.parse(localStorage.getItem(COLLAPSED_SECTIONS_KEY) || '[]');
      return Array.isArray(saved) ? saved.filter(k => typeof k === 'string') : [];
    } catch {
      return [];
    }
  }

  private initialWidth(): number {
    try {
      const saved = Number(localStorage.getItem(PANEL_WIDTH_KEY));
      if (saved) return this.clampWidth(saved);
    } catch {
      /* storage unavailable */
    }
    return this.clampWidth(DEFAULT_PANEL_WIDTH);
  }

  private clampWidth(w: number): number {
    const max = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, window.innerWidth - 120));
    return Math.max(MIN_PANEL_WIDTH, Math.min(max, w));
  }

  private updateClusterView(): void {
    if (!this.focusedCluster || this.focusedNode) {
      this.activeClusterGroup = null;
      this.childClusters = [];
      return;
    }

    const grp = this.clusterGroups[this.focusedCluster];
    if (!grp) return;

    this.activeClusterGroup = grp;
    const lvl = grp.level || 1;
    this.panelTitle = `CLUSTER / LEVEL ${lvl}`;

    const nextLevel = lvl + 1;
    this.childClusters = Object.keys(this.clusterGroups).filter(
      k => k.startsWith(this.focusedCluster + ' / ') && this.clusterGroups[k].level === nextLevel
    );
  }
}