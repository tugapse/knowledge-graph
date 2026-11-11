import {
  Component,
  ElementRef,
  OnInit,
  OnDestroy,
  ViewChild,
  ChangeDetectionStrategy,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import ForceGraph3D from '3d-force-graph';
import { Subscription } from 'rxjs';
import { GraphStateService } from '../../services/graph-state.service';
import { GraphHierarchyService } from '../../services/graph-hierarchy.service';
import { DEFAULT_GRAPH_CONFIG } from '../../core/graph.config';
import { GraphNode, GraphConfig, GraphLink } from '../../core/graph.model';
import { GraphHudComponent } from '../graph-hud/graph-hud';

const getNodeId = (target: string | GraphNode): string => {
  return typeof target === 'object' ? target.id : target;
};

@Component({
  selector: 'app-graph-viewport',
  standalone: true,
  imports: [CommonModule, GraphHudComponent],
  templateUrl: './graph-viewport.html',
  styleUrl:'./graph-viewport.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphViewportComponent implements OnInit, OnDestroy {
  @ViewChild('graphCanvas', { static: true }) graphCanvas!: ElementRef<HTMLDivElement>;

  private graphInstance: any = null;
  private config: GraphConfig = DEFAULT_GRAPH_CONFIG;
  private subscriptions: Subscription = new Subscription();

  private highlightNodes = new Set<string>();
  private semiHighlightNodes = new Set<string>();
  private rootClusterNodes = new Set<string>();
  private highlightLinks = new Set<GraphLink>();
  private searchMatchingNodes = new Set<string>();
  private focusedNode: GraphNode | null = null;
  private selectionIntensity = 0;

  constructor(
    private state: GraphStateService,
    private hierarchy: GraphHierarchyService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.initGraphInstance();
    this.bindStateStreams();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.graphInstance) {
      this.graphInstance._destructor?.();
      this.graphInstance = null;
    }
  }

  public resetCamera(): void {
    if (this.graphInstance) {
      this.graphInstance.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 1000);
    }
  }

  public getScreenCoords(x: number, y: number, z: number): { x: number; y: number } | null {
    if (!this.graphInstance) return null;
    return this.graphInstance.graph2ScreenCoords(x, y, z);
  }

  private initGraphInstance(): void {
    this.ngZone.runOutsideAngular(() => {
      this.graphInstance = (ForceGraph3D as any)()(this.graphCanvas.nativeElement)
        .backgroundColor('#030a13')
        .warmupTicks(0)
        .cooldownTime(18000)
        .d3VelocityDecay(0.85)
        .d3AlphaDecay(0.005)
        .enableNodeDrag(false)
        .nodeResolution(18)
        .nodeLabel((node: GraphNode) => `
          <div style="background: rgba(2, 16, 32, 0.95); border: 1px solid #00f0ff; border-left: 3px solid #00f0ff; padding: 8px 12px; font-family: 'Inter', sans-serif; box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; color: #00f0ff; letter-spacing: 0.5px;">${node.name || node.id}</div>
            <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; margin-top: 3px;">SUBSYSTEM: <span style="color: #fff; font-weight: 600;">${node.subsystem}</span> // TYPE: <span style="color: #00f0ff; font-weight: 600;">${node.group || 'unknown'}</span></div>
            <div style="font-size: 10px; color: #94a3b8; margin-top: 3px;">LINKS: <span style="color: #fff; font-weight: 600;">${node.connectionCount}</span></div>
          </div>
        `)
        .nodeColor((node: GraphNode) => this.calculateNodeColor(node))
        .nodeVal((node: GraphNode) => {
          if (this.focusedNode && this.focusedNode.id === node.id) return 14;
          if (this.highlightNodes.has(node.id)) return 7;
          if (this.semiHighlightNodes.has(node.id)) return 5.2;
          if (this.searchMatchingNodes.size > 0 && this.searchMatchingNodes.has(node.id)) return 10;
          return node.group === 'module' ? 7 : 3.8;
        })
        .linkColor((link: GraphLink) => this.calculateLinkColor(link))
        .linkWidth((link: GraphLink) => {
          const sId = getNodeId(link.source);
          const tId = getNodeId(link.target);
          if (this.selectionIntensity > 0) {
            if (this.highlightLinks.has(link)) return 0.8 + (2.2 - 0.8) * this.selectionIntensity;
            if (this.searchMatchingNodes.size > 0 && this.searchMatchingNodes.has(sId) && this.searchMatchingNodes.has(tId)) {
              return 0.8 + (1.2 - 0.8) * this.selectionIntensity;
            }
          }
          return 0.8;
        })
        .linkDirectionalParticles((link: GraphLink) => {
          if (this.selectionIntensity === 0.0) return 2;
          if (this.highlightLinks.has(link)) return 4;
          const sId = getNodeId(link.source);
          const tId = getNodeId(link.target);
          if (this.searchMatchingNodes.size > 0 && this.searchMatchingNodes.has(sId) && this.searchMatchingNodes.has(tId)) return 2;
          return 0;
        })
        .linkDirectionalParticleColor((link: GraphLink) => {
          const base = this.hierarchy.getLinkBaseColor(link);
          return `rgb(${base.r}, ${base.g}, ${base.b})`;
        })
        .linkDirectionalParticleWidth((link: GraphLink) => (this.highlightLinks.has(link) ? 2.5 : 1.5))
        .linkDirectionalParticleSpeed((link: GraphLink) => {
          const baseSpeed = this.highlightLinks.has(link) ? 0.012 : 0.005;
          const rel = (link.relation || '').toLowerCase();
          return rel === 'imports' ? -baseSpeed : baseSpeed;
        })
        .onNodeClick((node: GraphNode) => {
          this.ngZone.run(() => {
            this.state.selectNode(node);
          });
        })
        .onBackgroundClick(() => {
          this.ngZone.run(() => {
            this.state.clearSelection();
          });
        });

      this.applyPhysicsSettings();
    });
  }

  private bindStateStreams(): void {
    this.subscriptions.add(
      this.state.graphData$.subscribe(data => {
        if (!data || !this.graphInstance) return;
        this.graphInstance.graphData(data);
        this.applyPhysicsSettings();
      })
    );

    this.subscriptions.add(
      this.state.focusedNode$.subscribe(node => {
        this.focusedNode = node;
        this.refreshVisualState();
      })
    );

    this.subscriptions.add(
      this.state.selectionIntensity$.subscribe(val => {
        this.selectionIntensity = val;
        this.refreshVisualState();
      })
    );

    this.subscriptions.add(
      this.state.highlightNodes$.subscribe(nodes => {
        this.highlightNodes = nodes;
        this.refreshVisualState();
      })
    );

    this.subscriptions.add(
      this.state.semiHighlightNodes$.subscribe(nodes => {
        this.semiHighlightNodes = nodes;
        this.refreshVisualState();
      })
    );

    this.subscriptions.add(
      this.state.rootClusterNodes$.subscribe(nodes => {
        this.rootClusterNodes = nodes;
        this.refreshVisualState();
      })
    );

    this.subscriptions.add(
      this.state.highlightLinks$.subscribe(links => {
        this.highlightLinks = links;
        this.refreshVisualState();
      })
    );

    this.subscriptions.add(
      this.state.searchMatchingNodes$.subscribe(nodes => {
        this.searchMatchingNodes = nodes;
        this.refreshVisualState();
      })
    );

    this.subscriptions.add(
      this.state.cameraTarget$.subscribe(target => {
        if (target && this.graphInstance) {
          this.graphInstance.cameraPosition(target.pos, target.lookAt, target.duration);
        }
      })
    );
  }

  private refreshVisualState(): void {
    if (!this.graphInstance) return;
    this.graphInstance
      .nodeColor(this.graphInstance.nodeColor())
      .nodeVal(this.graphInstance.nodeVal())
      .linkColor(this.graphInstance.linkColor())
      .linkWidth(this.graphInstance.linkWidth());
  }

  private calculateNodeColor(node: GraphNode): string {
    const base = this.hierarchy.getNodeBaseColor(node);
    if (this.selectionIntensity === 0.0) return `rgb(${base.r}, ${base.g}, ${base.b})`;

    if (this.searchMatchingNodes.size > 0) {
      if (this.searchMatchingNodes.has(node.id)) return this.config.colors.levels[1].hex;
      if (this.semiHighlightNodes.has(node.id)) {
        const lvlColor = this.hierarchy.getLevelColor(node);
        return `rgba(${lvlColor.rgb}, ${this.config.colors.opacities.nodes.sameCluster})`;
      }
      const dimAlpha = 1.0 - (1.0 - this.config.colors.opacities.nodes.unrelated) * this.selectionIntensity;
      return `rgba(${base.r}, ${base.g}, ${base.b}, ${dimAlpha.toFixed(3)})`;
    }

    if (this.highlightNodes.has(node.id)) {
      if (this.focusedNode && this.focusedNode.id === node.id) return '#ffffff';
      return `rgb(${base.r}, ${base.g}, ${base.b})`;
    }

    if (this.semiHighlightNodes.has(node.id)) {
      const lvlColor = this.hierarchy.getLevelColor(node);
      const semiAlpha = 1.0 - (1.0 - this.config.colors.opacities.nodes.sameCluster) * this.selectionIntensity;
      return `rgba(${lvlColor.rgb}, ${semiAlpha.toFixed(3)})`;
    }

    if (this.rootClusterNodes.has(node.id)) {
      const lvlColor = this.hierarchy.getLevelColor(node);
      const rootAlpha = 1.0 - (1.0 - this.config.colors.opacities.nodes.sameRoot) * this.selectionIntensity;
      return `rgba(${lvlColor.rgb}, ${rootAlpha.toFixed(3)})`;
    }

    const dimAlpha = 1.0 - (1.0 - this.config.colors.opacities.nodes.unrelated) * this.selectionIntensity;
    return `rgba(${base.r}, ${base.g}, ${base.b}, ${dimAlpha.toFixed(3)})`;
  }

  private calculateLinkColor(link: GraphLink): string {
    const base = this.hierarchy.getLinkBaseColor(link);
    const sId = getNodeId(link.source);
    const tId = getNodeId(link.target);

    if (this.selectionIntensity === 0.0) return `rgba(${base.r}, ${base.g}, ${base.b}, 0.25)`;

    if (this.highlightLinks.has(link)) {
      const alpha = 0.25 + (this.config.colors.opacities.links.focused - 0.25) * this.selectionIntensity;
      return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha.toFixed(3)})`;
    }

    if (this.searchMatchingNodes.size > 0 && this.searchMatchingNodes.has(sId) && this.searchMatchingNodes.has(tId)) {
      const alpha = 0.25 + (this.config.colors.opacities.links.internalCluster - 0.25) * this.selectionIntensity;
      return `rgba(${base.r}, ${base.g}, ${base.b}, ${alpha.toFixed(3)})`;
    }

    if (this.semiHighlightNodes.has(sId) && this.semiHighlightNodes.has(tId)) {
      return `rgba(${base.r}, ${base.g}, ${base.b}, ${this.config.colors.opacities.links.siblingCluster})`;
    }

    const alpha = 0.25 - (0.25 - this.config.colors.opacities.links.unrelated) * this.selectionIntensity;
    return `rgba(30, 41, 59, ${alpha.toFixed(3)})`;
  }

  public applyPhysicsSettings(): void {
    if (!this.graphInstance || !this.state.graphData) return;

    if (this.config.dag.enabled) {
      this.graphInstance.dagMode(this.config.dag.mode).dagLevelDistance(this.config.dag.distance);
      this.graphInstance.d3Force('cluster', null);
      this.graphInstance.d3Force('link').strength(0);
      this.graphInstance.d3Force('charge').strength(-5000);
      return;
    }

    this.graphInstance.dagMode(null);
    const clusterAlpha = this.config.physics.clusterGravity.alpha;

    this.graphInstance.d3Force('cluster', () => {
      const nodes = this.state.graphData?.nodes || [];
      const groups = this.state.clusterGroups;

      nodes.forEach(node => {
        if (typeof node.x !== 'number' || typeof node.y !== 'number' || typeof node.z !== 'number') return;
        if (!node.subsystem) return;

        const grp = groups[node.subsystem];
        if (grp && grp.targetCenter) {
          const dx = grp.targetCenter.x - node.x;
          const dy = grp.targetCenter.y - node.y;
          const dz = grp.targetCenter.z - node.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist === 0) return;

          const stopRadius = this.config.physics.clusterGravity.stopRadiusBase +
            (Math.sqrt(grp.length) * this.config.physics.clusterGravity.stopRadiusScale);

          if (dist > stopRadius) {
            const factor = ((dist - stopRadius) / dist) * clusterAlpha;
            node.vx = (node.vx || 0) + dx * factor;
            node.vy = (node.vy || 0) + dy * factor;
            node.vz = (node.vz || 0) + dz * factor;
          }
        }
      });
    });

    this.graphInstance.d3Force('link')
      .distance((link: any) => {
        const sSub = link.source.subsystem;
        const tSub = link.target.subsystem;
        const sL1 = link.source._levels ? link.source._levels[0] : null;
        const tL1 = link.target._levels ? link.target._levels[0] : null;
        const sL2 = link.source._levels && link.source._levels.length > 1 ? link.source._levels.slice(0, 2).join(' / ') : null;
        const tL2 = link.target._levels && link.target._levels.length > 1 ? link.target._levels.slice(0, 2).join(' / ') : null;

        if (sSub === tSub) return this.config.physics.links.distance.internal;
        if (sL2 && sL2 === tL2) return this.config.physics.links.distance.l2Sibling;
        if (sL1 === tL1) return this.config.physics.links.distance.l1Sibling;
        return this.config.physics.links.distance.external;
      })
      .strength((link: any) => {
        const sSub = link.source.subsystem;
        const tSub = link.target.subsystem;
        const sL1 = link.source._levels ? link.source._levels[0] : null;
        const tL1 = link.target._levels ? link.target._levels[0] : null;

        if (sSub === tSub) return this.config.physics.links.strength.internal;
        if (sL1 === tL1) return this.config.physics.links.strength.l1Sibling;
        return this.config.physics.links.strength.external;
      });

    this.graphInstance.d3Force('charge').strength(this.config.physics.charge);
  }
}