import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { GraphStateService, NeighborRelation } from '../../services/graph-state.service';
import { GraphHierarchyService } from '../../services/graph-hierarchy.service';
import { DEFAULT_GRAPH_CONFIG } from '../../core/graph.config';
import { GraphNode, ClusterGroup } from '../../core/graph.model';

import * as marked from 'marked';

@Component({
  selector: 'app-graph-inspector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graph-inspector.html',
  styleUrl: './graph-inspector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphInspectorComponent implements OnInit, OnDestroy {
  activeTab: 'specs' | 'docs' | 'raw' = 'specs';
  panelTitle = 'COMPONENT INSPECTOR';
  isCollapsed = false;
  canGoBack = false;

  focusedNode: GraphNode | null = null;
  focusedCluster: string | null = null;
  clusterGroups: Record<string, ClusterGroup> = {};
  activeClusterGroup: ClusterGroup | null = null;
  childClusters: string[] = [];

  breadcrumbs: { name: string; path: string }[] = [];
  semiHighlightCount = 0;
  parentClusterName = '';
  activeNeighbors: NeighborRelation[] = [];
  rawHtml: SafeHtml | string = '';

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
    private cdr: ChangeDetectorRef,
    private sanitizer: DomSanitizer
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

  toggleCollapse(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  onBack(): void {
    // Logic to navigate back in state
    this.state.goBack();
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

    if (this.focusedNode.raw_markdown) {
      Promise.resolve(marked.parse(this.focusedNode.raw_markdown)).then((html: string) => {
        this.rawHtml = this.sanitizer.bypassSecurityTrustHtml(html);
        this.cdr.markForCheck();
      }).catch(() => {
        this.rawHtml = '';
      });
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