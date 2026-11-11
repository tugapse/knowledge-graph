import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GraphStateService } from '../../services/graph-state.service';
import { DEFAULT_GRAPH_CONFIG } from '../../core/graph.config';
import { ClusterGroup, GraphNode } from '../../core/graph.model';
import { GraphViewportComponent } from '../graph-viewport/graph-viewport';
import { GraphSearchComponent } from '../graph-search/graph-search';
import { GraphStyleService } from '../../services/graph-style.service';

export const DEFAULT_HUD_TITLE = 'KNOWLEDGE GRAPH // EXPLORER';

interface ProjectedBadge {
  id: string;
  name: string;
  shortName: string;
  count: number;
  level: number;
  x: number;
  y: number;
  opacity: number;
  scale: number;
  borderColor: string;
  color: string;
  textShadow: string;
  fontSize: string;
}

interface ProjectedPill {
  id: string;
  name: string;
  x: number;
  y: number;
  isTarget: boolean;
  opacity: number;
  scale: number;
}


@Component({
  selector: 'app-graph-hud',
  standalone: true,
  imports: [CommonModule, GraphSearchComponent],
  templateUrl: './graph-hud.html',
  styleUrl:'./graph-hud.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphHudComponent implements OnInit, OnDestroy {
  @Input() viewport!: GraphViewportComponent;
  /** Header title; falls back to DEFAULT_HUD_TITLE when empty or not provided. */
  @Input() title?: string | null;

  get displayTitle(): string {
    return this.title?.trim() || DEFAULT_HUD_TITLE;
  }

  visibleBadges: ProjectedBadge[] = [];
  visiblePills: ProjectedPill[] = [];

  private animFrameId: number | null = null;
  private subscriptions = new Subscription();

  private clusterGroups: Record<string, ClusterGroup> = {};
  public nodes: GraphNode[] = [];
  public focusedNode: GraphNode | null = null;
  private focusedClusterPrefix: string | null = null;
  private highlightNodes = new Set<string>();
  private searchMatchingNodes = new Set<string>();
  private selectionIntensity = 0;
  isInspectorCollapsed = false;
  activeTab = 'specs';
  searchQuery = '';

  constructor(
    private state: GraphStateService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone,
    private styleService: GraphStyleService
  ) {}

  get pillFontSize(): number {
    return this.styleService.style.labels.pillFontSize;
  }

  switchTab(tabId: string): void {
    this.activeTab = tabId;
    this.cdr.markForCheck();
  }

  toggleInspectorPanel(): void {
    this.isInspectorCollapsed = !this.isInspectorCollapsed;
    this.cdr.markForCheck();
  }

  onSearchInput(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
    this.searchQuery = query;
    const q = query.trim().toLowerCase();
    
    if (!q) {
      this.state.setSearchMatchingNodes(new Set());
      return;
    }
    
    const matches = this.nodes.filter(n => 
      (n.id || '').toLowerCase().includes(q) ||
      (n.name || '').toLowerCase().includes(q) ||
      (n.group || '').toLowerCase().includes(q) ||
      (n.subsystem || '').toLowerCase().includes(q)
    );
    this.state.setSearchMatchingNodes(new Set(matches.map(m => m.id)));
  }

  resetCamera(): void {
    if (this.viewport) {
      this.viewport.resetCamera();
    }
  }

  goBackInspectorSelection(): void {
    this.state.selectNode(null);
  }

  ngOnInit(): void {
    this.subscriptions.add(
      this.state.clusterGroups$.subscribe(groups => (this.clusterGroups = groups))
    );
    this.subscriptions.add(
      this.state.graphData$.subscribe(data => (this.nodes = data?.nodes || []))
    );
    this.subscriptions.add(
      this.state.focusedNode$.subscribe(node => (this.focusedNode = node))
    );
    this.subscriptions.add(
      this.state.focusedCluster$.subscribe(cluster => (this.focusedClusterPrefix = cluster))
    );
    this.subscriptions.add(
      this.state.highlightNodes$.subscribe(nodes => (this.highlightNodes = nodes))
    );
    this.subscriptions.add(
      this.state.searchMatchingNodes$.subscribe(nodes => (this.searchMatchingNodes = nodes))
    );
    this.subscriptions.add(
      this.state.selectionIntensity$.subscribe(val => (this.selectionIntensity = val))
    );

    this.startProjectionLoop();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  onClusterClick(clusterName: string, event: MouseEvent): void {
    event.stopPropagation();
    this.state.selectCluster(
      clusterName,
      DEFAULT_GRAPH_CONFIG.camera.badgeYOffset,
      DEFAULT_GRAPH_CONFIG.camera.baseDistance,
      DEFAULT_GRAPH_CONFIG.camera.distanceScale
    );
  }

  onNodeClick(nodeId: string, event: MouseEvent): void {
    event.stopPropagation();
    const node = this.nodes.find(n => n.id === nodeId);
    if (node) {
      this.state.selectNode(node);
    }
  }

  private startProjectionLoop(): void {
    this.ngZone.runOutsideAngular(() => {
      const render = () => {
        this.updateProjections();
        this.animFrameId = requestAnimationFrame(render);
      };
      this.animFrameId = requestAnimationFrame(render);
    });
  }

  private updateProjections(): void {
    if (!this.viewport) return;

    const badges: ProjectedBadge[] = [];
    const activeClusterLvl = this.focusedClusterPrefix && this.clusterGroups[this.focusedClusterPrefix]
      ? (this.clusterGroups[this.focusedClusterPrefix].level || 0)
      : 0;

    // Label tiers (configurable in the style panel):
    // active = the focused level, child = nested inside it, faded = ancestors / unrelated.
    const {
      activeOpacity: ACTIVE_OPACITY,
      childOpacity: CHILD_OPACITY,
      fadedOpacity: FADED_OPACITY,
      activeScale: ACTIVE_SCALE,
      badgeFontSize
    } = this.styleService.style.labels;

    // The "active level": the focused cluster, or the cluster the focused node lives in.
    const activeClusterKey = this.focusedClusterPrefix ?? this.focusedNode?.subsystem ?? null;

    Object.entries(this.clusterGroups).forEach(([name, grp]) => {
      const lvl = grp.level || 1;
      const validCount = grp.length;
      if (validCount === 0) return;

      let sumX = 0, sumY = 0, sumZ = 0;
      let count = 0;
      grp.forEach(n => {
        if (typeof n.x === 'number' && typeof n.y === 'number' && typeof n.z === 'number') {
          sumX += n.x;
          sumY += n.y;
          sumZ += n.z;
          count++;
        }
      });
      if (count === 0) return;

      const avgX = sumX / count;
      const avgY = sumY / count + (DEFAULT_GRAPH_CONFIG.camera.badgeYOffset[lvl] || 10);
      const avgZ = sumZ / count;

      const screenPos = this.viewport.getScreenCoords(avgX, avgY, avgZ);
      if (!screenPos) return;

      let isVisible = false;
      let opacity = 0;

      if (this.focusedNode) {
        const nLevels = this.focusedNode._levels || [];
        const parentKey = nLevels.length > 1 ? nLevels.slice(0, -1).join(' / ') : null;
        const rootKey = nLevels[0];

        if (name === this.focusedNode.subsystem) {
          isVisible = true; opacity = ACTIVE_OPACITY;
        } else if (name === parentKey && this.focusedNode.subsystem !== parentKey) {
          isVisible = true; opacity = FADED_OPACITY;
        } else if (name === rootKey && this.focusedNode.subsystem !== rootKey) {
          isVisible = true; opacity = FADED_OPACITY;
        }
      } else if (this.focusedClusterPrefix) {
        const focusedGrp = this.clusterGroups[this.focusedClusterPrefix];
        const parentKey = focusedGrp ? focusedGrp.parentKey : null;
        const grandParentKey = focusedGrp && parentKey && this.clusterGroups[parentKey] ? this.clusterGroups[parentKey].parentKey : null;

        if (name === this.focusedClusterPrefix) {
          isVisible = true; opacity = ACTIVE_OPACITY;
        } else if (name.startsWith(this.focusedClusterPrefix + ' / ') && lvl === activeClusterLvl + 1) {
          isVisible = true; opacity = CHILD_OPACITY;
        } else if (name === parentKey) {
          isVisible = true; opacity = FADED_OPACITY;
        } else if (name === grandParentKey) {
          isVisible = true; opacity = FADED_OPACITY;
        }
      } else if (this.searchMatchingNodes.size === 0) {
        if (lvl === 1) {
          isVisible = true;
          opacity = ACTIVE_OPACITY;
        }
      }

      if (isVisible) {
        const colors = this.styleService.levelColor(lvl);
        badges.push({
          id: name,
          name,
          shortName: grp.shortName || name,
          count: validCount,
          level: lvl,
          x: screenPos.x,
          y: screenPos.y,
          opacity,
          scale: name === activeClusterKey ? ACTIVE_SCALE : 1,
          borderColor: `rgba(${colors.rgb}, 0.75)`,
          color: colors.hex,
          textShadow: `0 0 8px rgba(${colors.rgb}, 0.4)`,
          fontSize: `${lvl === 1 ? badgeFontSize : lvl === 2 ? badgeFontSize - 2 : Math.max(9, badgeFontSize - 1 - lvl)}px`
        });
      }
    });

    // Pills projection
    const pills: ProjectedPill[] = [];
    let nodesToLabel = new Set<string>();
    const activeNodeSet = this.highlightNodes.size > 0
      ? this.highlightNodes
      : this.searchMatchingNodes.size > 0
      ? this.searchMatchingNodes
      : null;

    if (activeNodeSet) {
      if (activeNodeSet.size <= this.styleService.style.labels.maxPills) {
        nodesToLabel = new Set(activeNodeSet);
      }
      if (this.focusedNode) {
        nodesToLabel.add(this.focusedNode.id);
      }
    }

    nodesToLabel.forEach(nodeId => {
      const node = this.nodes.find(n => n.id === nodeId);
      if (!node || typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') return;

      const screenPos = this.viewport.getScreenCoords(node.x, node.y, node.z);
      if (!screenPos) return;

      const isTarget = !!(this.focusedNode && this.focusedNode.id === node.id);
      const isActive = isTarget || (activeClusterKey !== null && node.subsystem === activeClusterKey);
      const isChild = activeClusterKey !== null && (node.subsystem || '').startsWith(activeClusterKey + ' / ');
      // Direct connections of the selected node are always fully visible, wherever they live.
      const isDirectNeighbor = !!this.focusedNode && this.highlightNodes.has(node.id);
      const opacity = activeClusterKey === null
        ? 0.2 + 0.8 * this.selectionIntensity
        : isActive || isDirectNeighbor ? ACTIVE_OPACITY : isChild ? CHILD_OPACITY : FADED_OPACITY;

      pills.push({
        id: node.id,
        name: node.name || node.id.split('/').pop()?.split('#').pop() || '',
        x: screenPos.x,
        y: screenPos.y - 14,
        isTarget,
        opacity: Number(opacity.toFixed(2)),
        scale: isActive && activeClusterKey !== null ? ACTIVE_SCALE : 1
      });
    });

    this.visibleBadges = badges;
    this.visiblePills = pills;
    this.cdr.detectChanges();
  }
}