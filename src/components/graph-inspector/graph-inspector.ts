import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GraphStateService, NeighborRelation } from '../../services/graph-state.service';
import { GraphHierarchyService } from '../../services/graph-hierarchy.service';
import { DEFAULT_GRAPH_CONFIG } from '../../core/graph.config';
import { GraphNode, ClusterGroup } from '../../core/graph.model';

declare const marked: any;

@Component({
  selector: 'app-graph-inspector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="inspector-panel">
      <!-- Header Tabs -->
      <header class="panel-header">
        <h2 class="panel-title">{{ panelTitle }}</h2>
        <nav class="tab-nav">
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'specs'"
            (click)="activeTab = 'specs'"
          >SPECS</button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'docs'"
            (click)="activeTab = 'docs'"
          >DOCS</button>
          <button
            type="button"
            class="tab-btn"
            [class.active]="activeTab === 'raw'"
            (click)="activeTab = 'raw'"
          >RAW</button>
        </nav>
      </header>

      <section class="panel-body">
        <!-- SPECS TAB -->
        <div *ngIf="activeTab === 'specs'" class="tab-content">
          <!-- 1. Node Selected View -->
          <ng-container *ngIf="focusedNode; else clusterOrLegendView">
            <div class="property">
              <span class="prop-title">IDENTIFIER / PATH</span>
              <strong class="code-val">{{ focusedNode.id }}</strong>
            </div>

            <div class="property">
              <span class="prop-title">CLUSTER HIERARCHY (CLICK TO FOCUS)</span>
              <div class="breadcrumbs">
                <ng-container *ngFor="let crumb of breadcrumbs; let last = last">
                  <span class="crumb-link" (click)="onFocusCluster(crumb.path)">{{ crumb.name }}</span>
                  <span *ngIf="!last" class="crumb-separator">/</span>
                </ng-container>
              </div>
            </div>

            <div class="property">
              <span class="prop-title">PARENT CLUSTER SIBLINGS</span>
              <span class="prop-subtext">{{ semiHighlightCount }} semi-highlighted in <strong>{{ parentClusterName }}</strong></span>
            </div>

            <div class="property">
              <span class="prop-title">COMPONENT TYPE</span>
              <span class="prop-type">{{ focusedNode.group || 'unknown' }}</span>
            </div>

            <div class="property">
              <span class="prop-title">CONNECTIONS (CENTRALITY)</span>
              <span class="prop-val">{{ focusedNode.connectionCount || 0 }} Links</span>
            </div>

            <div *ngIf="focusedNode.signature" class="property">
              <span class="prop-title">SIGNATURE</span>
              <div class="signature-box">{{ focusedNode.signature }}</div>
            </div>

            <div *ngIf="focusedNode.semantic_summary" class="property">
              <span class="prop-title">SEMANTIC SUMMARY</span>
              <div class="value-box">{{ focusedNode.semantic_summary }}</div>
            </div>

            <div *ngIf="activeNeighbors.length > 0" class="property">
              <span class="prop-title">CONNECTED GRAPH RELATIONS ({{ activeNeighbors.length }})</span>
              <div class="pill-list">
                <div
                  *ngFor="let p of activeNeighbors"
                  class="pill-item"
                  [style.borderLeftColor]="getLinkRgb(p.relation)"
                  (click)="onFocusNode(p.id)"
                >
                  <span class="pill-name">{{ p.dir }} {{ p.name }}</span>
                  <span class="pill-relation" [style.color]="getLinkRgb(p.relation)">{{ p.relation }}</span>
                </div>
              </div>
            </div>

            <div *ngIf="focusedNode.keywords && focusedNode.keywords.length > 0" class="property">
              <span class="prop-title">KEYWORDS</span>
              <div class="tag-container">
                <span *ngFor="let kw of focusedNode.keywords" class="tag">{{ kw }}</span>
              </div>
            </div>
          </ng-container>

          <!-- 2. Cluster Focused View or Default Legend -->
          <ng-template #clusterOrLegendView>
            <ng-container *ngIf="focusedCluster && activeClusterGroup; else defaultLegendView">
              <div *ngIf="activeClusterGroup.parentKey" class="mb-12">
                <div class="pill-item action-pill" (click)="onFocusCluster(activeClusterGroup.parentKey!)">
                  <span class="text-cyan"> BACK TO {{ getShortKey(activeClusterGroup.parentKey!) }}</span>
                  <span class="pill-relation">LEVEL {{ (activeClusterGroup.level || 1) - 1 }}</span>
                </div>
              </div>

              <div class="property">
                <span class="prop-title">SUBSYSTEM DOMAIN</span>
                <strong class="text-cyan font-15">{{ focusedCluster }}</strong>
              </div>

              <div class="property">
                <span class="prop-title">COMPONENTS DETECTED</span>
                <span class="prop-val">{{ activeClusterGroup.length }}</span>
              </div>

              <div *ngIf="childClusters.length > 0; else clusterNodesView" class="property">
                <span class="prop-title">CHILD SUB-CLUSTERS ({{ childClusters.length }})</span>
                <div class="pill-list">
                  <div *ngFor="let cKey of childClusters" class="pill-item" (click)="onFocusCluster(cKey)">
                    <span class="text-cyan"> {{ clusterGroups[cKey].shortName || cKey }}</span>
                    <span class="pill-relation">{{ clusterGroups[cKey].length }} nodes</span>
                  </div>
                </div>
              </div>

              <ng-template #clusterNodesView>
                <div class="property">
                  <span class="prop-title">NODES IN CLUSTER ({{ activeClusterGroup.length }})</span>
                  <div class="pill-list">
                    <div *ngFor="let n of activeClusterGroup" class="pill-item" (click)="onFocusNode(n.id)">
                      <span class="pill-name"> {{ n.name || n.id }}</span>
                      <span class="pill-relation">{{ n.group || 'node' }}</span>
                    </div>
                  </div>
                </div>
              </ng-template>
            </ng-container>

            <!-- 3. Default Empty / Legend View -->
            <ng-template #defaultLegendView>
              <p class="muted-note">Select a node in the graph to view technical specifications and memory context.</p>

              <div class="property mt-30">
                <span class="prop-title">LINK (PIPE) COLOR LEGEND</span>
                <div class="legend-list">
                  <div *ngFor="let item of legendItems" class="legend-row">
                    <div
                      class="legend-line"
                      [style.background]="'rgb(' + item.color.r + ',' + item.color.g + ',' + item.color.b + ')'"
                      [style.boxShadow]="'0 0 10px rgba(' + item.color.r + ',' + item.color.g + ',' + item.color.b + ', 0.8)'"
                    ></div>
                    <span class="legend-label">{{ item.label }}</span>
                  </div>
                </div>
              </div>
            </ng-template>
          </ng-template>
        </div>

        <!-- DOCS TAB -->
        <div *ngIf="activeTab === 'docs'" class="tab-content">
          <ng-container *ngIf="focusedNode; else noDocsView">
            <div *ngIf="focusedNode.human_overview" class="property">
              <span class="prop-title">OVERVIEW & PURPOSE</span>
              <div class="value-box border-cyan">{{ focusedNode.human_overview }}</div>
            </div>
            <div *ngIf="focusedNode.side_effects" class="property">
              <span class="prop-title">SIDE EFFECTS & BEHAVIOR</span>
              <div class="value-box border-red text-red">{{ focusedNode.side_effects }}</div>
            </div>
            <p *ngIf="!focusedNode.human_overview && !focusedNode.side_effects" class="muted-note">
              No architectural documentation found for this component.
            </p>
          </ng-container>
          <ng-template #noDocsView>
            <p class="muted-note">No architectural documentation available for entire cluster.</p>
          </ng-template>
        </div>

        <!-- RAW TAB -->
        <div *ngIf="activeTab === 'raw'" class="tab-content">
          <div *ngIf="rawHtml; else rawFallback" class="markdown-rendered" [innerHTML]="rawHtml"></div>
          <ng-template #rawFallback>
            <pre *ngIf="focusedNode?.raw_markdown; else noRawView" class="raw-pre">{{ focusedNode?.raw_markdown }}</pre>
          </ng-template>
          <ng-template #noRawView>
            <p class="muted-note">Documentation stream unavailable.</p>
          </ng-template>
        </div>
      </section>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      top: 0;
      right: 0;
      width: 360px;
      height: 100%;
      background: rgba(3, 10, 19, 0.94);
      border-left: 1px solid rgba(0, 240, 255, 0.25);
      box-shadow: -5px 0 25px rgba(0, 0, 0, 0.7);
      z-index: 20;
      color: #e2e8f0;
      font-family: 'Inter', sans-serif;
    }
    .inspector-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .panel-header {
      padding: 16px;
      border-bottom: 1px solid rgba(0, 240, 255, 0.15);
    }
    .panel-title {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #00f0ff;
      text-transform: uppercase;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tab-nav {
      display: flex;
      gap: 8px;
    }
    .tab-btn {
      flex: 1;
      background: rgba(2, 16, 32, 0.6);
      border: 1px solid rgba(148, 163, 184, 0.3);
      color: #94a3b8;
      padding: 6px 0;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      border-radius: 4px;
      transition: all 0.2s ease;
    }
    .tab-btn.active {
      background: rgba(0, 240, 255, 0.15);
      border-color: #00f0ff;
      color: #00f0ff;
    }
    .panel-body {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
    }
    .property {
      margin-bottom: 16px;
    }
    .prop-title {
      display: block;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .code-val {
      display: block;
      word-break: break-all;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #fff;
    }
    .breadcrumbs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }
    .crumb-link {
      color: #00f0ff;
      font-weight: 600;
      cursor: pointer;
      text-decoration: underline;
      font-size: 12px;
    }
    .crumb-separator {
      color: #64748b;
    }
    .prop-subtext {
      color: #cbd5e1;
      font-size: 12px;
    }
    .prop-type {
      color: #93c5fd;
      font-weight: 600;
      font-size: 13px;
    }
    .prop-val {
      color: #fff;
      font-weight: 600;
      font-size: 13px;
    }
    .signature-box, .value-box {
      background: rgba(2, 16, 32, 0.85);
      border: 1px solid rgba(0, 240, 255, 0.2);
      border-radius: 4px;
      padding: 10px;
      font-size: 12px;
      line-height: 1.5;
    }
    .signature-box {
      font-family: 'JetBrains Mono', monospace;
      color: #38bdf8;
    }
    .border-cyan { border-left: 3px solid #00f0ff; }
    .border-red { border-left: 3px solid #ef4444; }
    .text-red { color: #fca5a5; }
    .text-cyan { color: #00f0ff; }
    .font-15 { font-size: 15px; }
    .mb-12 { margin-bottom: 12px; }
    .mt-30 { margin-top: 30px; }
    .pill-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 6px;
    }
    .pill-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(2, 16, 32, 0.7);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 4px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 11px;
    }
    .action-pill {
      border-color: #00f0ff;
    }
    .pill-name {
      color: #e2e8f0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pill-relation {
      font-weight: bold;
      margin-left: 8px;
      font-size: 10px;
    }
    .tag-container {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .tag {
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.3);
      color: #00f0ff;
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 10px;
    }
    .muted-note {
      color: #64748b;
      font-style: italic;
      font-size: 13px;
      margin: 0;
    }
    .legend-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 12px;
    }
    .legend-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .legend-line {
      width: 28px;
      height: 4px;
      border-radius: 2px;
    }
    .legend-label {
      font-size: 11px;
      color: #cbd5e1;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .raw-pre {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #94a3b8;
      white-space: pre-wrap;
      word-break: break-all;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphInspectorComponent implements OnInit, OnDestroy {
  activeTab: 'specs' | 'docs' | 'raw' = 'specs';
  panelTitle = 'COMPONENT INSPECTOR';

  focusedNode: GraphNode | null = null;
  focusedCluster: string | null = null;
  clusterGroups: Record<string, ClusterGroup> = {};
  activeClusterGroup: ClusterGroup | null = null;
  childClusters: string[] = [];

  breadcrumbs: { name: string; path: string }[] = [];
  semiHighlightCount = 0;
  parentClusterName = '';
  activeNeighbors: NeighborRelation[] = [];
  rawHtml = '';

  legendItems = [
    { label: 'IMPORTS', color: DEFAULT_GRAPH_CONFIG.colors.links.imports },
    { label: 'CALLS / EXTENDS', color: DEFAULT_GRAPH_CONFIG.colors.links.calls },
    { label: 'INHERITS / DEPENDS_ON', color: DEFAULT_GRAPH_CONFIG.colors.links.inherits },
    { label: 'DEFAULT / OTHER', color: DEFAULT_GRAPH_CONFIG.colors.links.default }
  ];

  private subscriptions = new Subscription();

  constructor(
    private state: GraphStateService,
    private hierarchy: GraphHierarchyService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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
        this.updateNodeView();
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.state.focusedCluster$.subscribe(cluster => {
        this.focusedCluster = cluster;
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
    const node = this.state.graphData?.nodes.find(n => n.id === nodeId);
    if (node) {
      this.state.selectNode(node);
    }
  }

  getLinkRgb(relation: string): string {
    const c = this.hierarchy.getLinkBaseColor({ source: '', target: '', relation });
    return `rgb(${c.r}, ${c.g}, ${c.b})`;
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
      this.rawHtml = '';
      return;
    }

    this.panelTitle = this.focusedNode.name || 'COMPONENT';
    const levels = this.focusedNode._levels || [this.focusedNode.subsystem || 'CORE'];
    this.breadcrumbs = levels.map((lvlName, idx) => ({
      name: lvlName,
      path: levels.slice(0, idx + 1).join(' / ')
    }));
    this.parentClusterName = levels.length > 1 ? levels.slice(0, -1).join(' / ') : levels[0];

    if (this.focusedNode.raw_markdown && typeof marked !== 'undefined') {
      try {
        this.rawHtml = marked.parse(this.focusedNode.raw_markdown);
      } catch {
        this.rawHtml = '';
      }
    } else {
      this.rawHtml = '';
    }
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