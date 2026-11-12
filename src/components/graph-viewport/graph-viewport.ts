import {
  Component,
  ElementRef,
  Input,
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
import { GraphNode, GraphLink } from '../../core/graph.model';
import { GraphHudComponent } from '../graph-hud/graph-hud';
import { GraphStylePanelComponent } from '../graph-style-panel/graph-style-panel';
import { GraphStyleService, GraphStyleConfig, hexToRgb } from '../../services/graph-style.service';

const getNodeId = (target: string | GraphNode): string => {
  return typeof target === 'object' ? target.id : target;
};

interface Rgba { r: number; g: number; b: number; a: number }

/** How long a selection change takes to fade nodes/links to their new look. */
const FADE_MS = 320;
/** Muted tint unrelated links fade toward while something is selected. */
const DIM_LINK_RGB = { r: 71, g: 85, b: 105 };

const rgba = (c: { r: number; g: number; b: number }, a: number): Rgba => ({ r: c.r, g: c.g, b: c.b, a });
const parseRgbList = (rgb: string, a: number): Rgba => {
  const [r, g, b] = rgb.split(',').map(v => +v);
  return { r, g, b, a };
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpRgba = (a: Rgba, b: Rgba, t: number): Rgba => ({
  r: lerp(a.r, b.r, t), g: lerp(a.g, b.g, t), b: lerp(a.b, b.b, t), a: lerp(a.a, b.a, t)
});
const toCss = (c: Rgba) => `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${c.a.toFixed(3)})`;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Fade<T> { from: T; to: T; cur: T }

@Component({
  selector: 'app-graph-viewport',
  standalone: true,
  imports: [CommonModule, GraphHudComponent, GraphStylePanelComponent],
  templateUrl: './graph-viewport.html',
  styleUrl:'./graph-viewport.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphViewportComponent implements OnInit, OnDestroy {
  @ViewChild('graphCanvas', { static: true }) graphCanvas!: ElementRef<HTMLDivElement>;
  /** Forwarded to the HUD header; empty/undefined shows the default title. */
  @Input() title?: string | null;

  private graphInstance: any = null;
  private subscriptions: Subscription = new Subscription();

  private highlightNodes = new Set<string>();
  private semiHighlightNodes = new Set<string>();
  private rootClusterNodes = new Set<string>();
  private highlightLinks = new Set<GraphLink>();
  private searchMatchingNodes = new Set<string>();
  private focusedNode: GraphNode | null = null;
  private selectionIntensity = 0;

  // Selection fade: every node/link eases from its current look to the new target.
  private nodeFades = new Map<string, Fade<Rgba>>();
  private linkFades = new Map<GraphLink, Fade<Rgba>>();
  private widthFades = new Map<GraphLink, Fade<number>>();
  private fadeStart = 0;
  private fadeRaf: number | null = null;
  private retargetQueued = false;

  constructor(
    private state: GraphStateService,
    private hierarchy: GraphHierarchyService,
    private styleService: GraphStyleService,
    private ngZone: NgZone
  ) {}

  private physicsRebuildTimer: ReturnType<typeof setTimeout> | null = null;

  private get nodeStyle(): GraphStyleConfig {
    return this.styleService.style;
  }

  ngOnInit(): void {
    this.initGraphInstance();
    this.bindStateStreams();
  }

  ngOnDestroy(): void {
    if (this.physicsRebuildTimer) clearTimeout(this.physicsRebuildTimer);
    if (this.fadeRaf !== null) cancelAnimationFrame(this.fadeRaf);
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
        .backgroundColor(this.nodeStyle.scene.background)
        .warmupTicks(0)
        .cooldownTime(18000)
        .d3VelocityDecay(0.85)
        .d3AlphaDecay(0.005)
        .enableNodeDrag(false)
        .nodeResolution(this.nodeStyle.resolution)
        .nodeLabel((node: GraphNode) => `
          <div style="background: rgba(2, 16, 32, 0.95); border: 1px solid #00f0ff; border-left: 3px solid #00f0ff; padding: 8px 12px; font-family: 'Inter', sans-serif; box-shadow: 0 0 15px rgba(0, 240, 255, 0.4);">
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; color: #00f0ff; letter-spacing: 0.5px;">${node.name || node.id}</div>
            <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-top: 3px;">SUBSYSTEM: <span style="color: #fff; font-weight: 600;">${node.subsystem}</span> // TYPE: <span style="color: #00f0ff; font-weight: 600;">${node.group || 'unknown'}</span></div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 3px;">LINKS: <span style="color: #fff; font-weight: 600;">${node.connectionCount}</span></div>
          </div>
        `)
        .nodeColor((node: GraphNode) => toCss(this.nodeFades.get(node.id)?.cur ?? this.calculateNodeColor(node)))
        .nodeVal((node: GraphNode) => {
          const sizes = this.nodeStyle.sizes;
          if (this.focusedNode && this.focusedNode.id === node.id) return sizes.focused;
          if (this.highlightNodes.has(node.id)) return sizes.highlighted;
          if (this.semiHighlightNodes.has(node.id)) return sizes.semiHighlighted;
          if (this.searchMatchingNodes.size > 0 && this.searchMatchingNodes.has(node.id)) return sizes.searchMatch;
          return node.group === 'module' ? sizes.module : sizes.default;
        })
        .linkColor((link: GraphLink) => toCss(this.linkFades.get(link)?.cur ?? this.calculateLinkColor(link)))
        .linkWidth((link: GraphLink) => this.widthFades.get(link)?.cur ?? this.calculateLinkWidth(link))
        .linkDirectionalParticles((link: GraphLink) => {
          const p = this.nodeStyle.particles;
          if (this.selectionIntensity === 0.0) return p.idleCount;
          if (this.highlightLinks.has(link)) return p.highlightedCount;
          const sId = getNodeId(link.source);
          const tId = getNodeId(link.target);
          if (this.searchMatchingNodes.size > 0 && this.searchMatchingNodes.has(sId) && this.searchMatchingNodes.has(tId)) return p.searchCount;
          return 0;
        })
        .linkDirectionalParticleColor((link: GraphLink) => {
          const base = this.hierarchy.getLinkBaseColor(link);
          return `rgb(${base.r}, ${base.g}, ${base.b})`;
        })
        .linkDirectionalParticleWidth((link: GraphLink) =>
          this.highlightLinks.has(link) ? this.nodeStyle.particles.highlightedWidth : this.nodeStyle.particles.width
        )
        .linkDirectionalParticleSpeed((link: GraphLink) => {
          const p = this.nodeStyle.particles;
          const baseSpeed = this.highlightLinks.has(link) ? p.highlightedSpeed : p.speed;
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
    let lastResolution = this.nodeStyle.resolution;
    let lastBackground = this.nodeStyle.scene.background;
    let lastLayoutKey = this.layoutKey(this.nodeStyle);
    this.subscriptions.add(
      this.styleService.style$.subscribe(style => {
        if (!this.graphInstance) return;
        if (style.resolution !== lastResolution) {
          lastResolution = style.resolution;
          this.graphInstance.nodeResolution(style.resolution);
        }
        if (style.scene.background !== lastBackground) {
          lastBackground = style.scene.background;
          this.graphInstance.backgroundColor(style.scene.background);
        }
        const layoutKey = this.layoutKey(style);
        if (layoutKey !== lastLayoutKey) {
          lastLayoutKey = layoutKey;
          this.scheduleLayoutRebuild();
        }
        this.refreshVisualState();
      })
    );

    this.subscriptions.add(
      this.state.graphData$.subscribe(data => {
        if (!data || !this.graphInstance) return;
        this.nodeFades.clear();
        this.linkFades.clear();
        this.widthFades.clear();
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

  /** Physics/DAG changes need cluster centers recomputed and the simulation reheated. */
  private layoutKey(style: GraphStyleConfig): string {
    return JSON.stringify([style.physics, style.dag]);
  }

  private scheduleLayoutRebuild(): void {
    if (this.physicsRebuildTimer) clearTimeout(this.physicsRebuildTimer);
    this.physicsRebuildTimer = setTimeout(() => {
      this.physicsRebuildTimer = null;
      const data = this.state.graphData;
      if (!data || !this.graphInstance) return;
      this.state.setClusterGroups(this.hierarchy.buildClusterGroups(data.nodes));
      this.applyPhysicsSettings();
      this.graphInstance.d3ReheatSimulation?.();
    }, 250);
  }

  /** Several streams change together on a selection, so retarget once per tick. */
  private refreshVisualState(): void {
    if (!this.graphInstance || this.retargetQueued) return;
    this.retargetQueued = true;
    queueMicrotask(() => {
      this.retargetQueued = false;
      this.retargetFades();
    });
  }

  private retargetFades(): void {
    const data = this.state.graphData;
    if (!this.graphInstance || !data) return;

    const retarget = <K, T>(map: Map<K, Fade<T>>, key: K, to: T, copy: (v: T) => T) => {
      const f = map.get(key);
      if (f) {
        f.from = copy(f.cur);
        f.to = to;
      } else {
        map.set(key, { from: to, to, cur: copy(to) });
      }
    };
    const copyRgba = (c: Rgba) => ({ ...c });
    const same = (n: number) => n;

    data.nodes.forEach(n => retarget(this.nodeFades, n.id, this.calculateNodeColor(n), copyRgba));
    data.links.forEach(l => {
      retarget(this.linkFades, l, this.calculateLinkColor(l), copyRgba);
      retarget(this.widthFades, l, this.calculateLinkWidth(l), same);
    });

    // Sizes and particles snap; the camera move covers it.
    this.graphInstance
      .nodeVal(this.graphInstance.nodeVal())
      .linkDirectionalParticles(this.graphInstance.linkDirectionalParticles());

    this.fadeStart = performance.now();
    if (this.fadeRaf === null) {
      this.ngZone.runOutsideAngular(() => (this.fadeRaf = requestAnimationFrame(this.fadeStep)));
    }
  }

  private fadeStep = (): void => {
    if (!this.graphInstance) {
      this.fadeRaf = null;
      return;
    }
    const t = Math.min(1, (performance.now() - this.fadeStart) / FADE_MS);
    const e = easeInOut(t);
    this.nodeFades.forEach(f => (f.cur = lerpRgba(f.from, f.to, e)));
    this.linkFades.forEach(f => (f.cur = lerpRgba(f.from, f.to, e)));
    this.widthFades.forEach(f => (f.cur = lerp(f.from, f.to, e)));

    this.graphInstance
      .nodeColor(this.graphInstance.nodeColor())
      .linkColor(this.graphInstance.linkColor())
      .linkWidth(this.graphInstance.linkWidth());

    this.fadeRaf = t < 1 ? requestAnimationFrame(this.fadeStep) : null;
  };

  private calculateNodeColor(node: GraphNode): Rgba {
    const base = this.hierarchy.getNodeBaseColor(node);
    const op = this.nodeStyle.opacities;
    const I = this.selectionIntensity;
    if (I === 0.0) return rgba(base, 1);

    if (this.searchMatchingNodes.size > 0) {
      if (this.searchMatchingNodes.has(node.id)) return parseRgbList(this.styleService.levelColor(1).rgb, 1);
      if (this.semiHighlightNodes.has(node.id)) return parseRgbList(this.hierarchy.getLevelColor(node).rgb, op.sameCluster);
      return rgba(base, 1 - (1 - op.unrelated) * I);
    }

    if (this.highlightNodes.has(node.id)) {
      if (this.focusedNode && this.focusedNode.id === node.id) return rgba(hexToRgb(this.nodeStyle.scene.focusedNodeColor), 1);
      return rgba(base, 1);
    }

    if (this.semiHighlightNodes.has(node.id)) {
      return parseRgbList(this.hierarchy.getLevelColor(node).rgb, 1 - (1 - op.sameCluster) * I);
    }

    if (this.rootClusterNodes.has(node.id)) {
      return parseRgbList(this.hierarchy.getLevelColor(node).rgb, 1 - (1 - op.sameRoot) * I);
    }

    return rgba(base, 1 - (1 - op.unrelated) * I);
  }

  private calculateLinkColor(link: GraphLink): Rgba {
    const base = this.hierarchy.getLinkBaseColor(link);
    const sId = getNodeId(link.source);
    const tId = getNodeId(link.target);
    const op = this.nodeStyle.linkOpacities;
    const I = this.selectionIntensity;

    if (I === 0.0) return rgba(base, op.idle);
    if (this.highlightLinks.has(link)) return rgba(base, lerp(op.idle, op.focused, I));
    if (this.searchMatchingNodes.size > 0 && this.searchMatchingNodes.has(sId) && this.searchMatchingNodes.has(tId)) {
      return rgba(base, lerp(op.idle, op.internalCluster, I));
    }
    if (this.semiHighlightNodes.has(sId) && this.semiHighlightNodes.has(tId)) {
      return rgba(base, lerp(op.idle, op.siblingCluster, I));
    }
    // Unrelated: drift toward a muted slate so the selection stands out, but stay visible.
    return lerpRgba(rgba(base, op.idle), rgba(DIM_LINK_RGB, op.unrelated), I);
  }

  private calculateLinkWidth(link: GraphLink): number {
    const w = this.nodeStyle.linkWidths;
    const I = this.selectionIntensity;
    if (I > 0) {
      if (this.highlightLinks.has(link)) return lerp(w.base, w.highlighted, I);
      const sId = getNodeId(link.source);
      const tId = getNodeId(link.target);
      if (this.searchMatchingNodes.size > 0 && this.searchMatchingNodes.has(sId) && this.searchMatchingNodes.has(tId)) {
        return lerp(w.base, w.searchMatch, I);
      }
    }
    return w.base;
  }

  public applyPhysicsSettings(): void {
    if (!this.graphInstance || !this.state.graphData) return;
    const { dag, physics } = this.nodeStyle;

    if (dag.enabled) {
      this.graphInstance.dagMode(dag.mode).dagLevelDistance(dag.distance);
      this.graphInstance.d3Force('cluster', null);
      this.graphInstance.d3Force('link').strength(0);
      this.graphInstance.d3Force('charge').strength(-5000);
      return;
    }

    this.graphInstance.dagMode(null);
    const clusterAlpha = physics.clusterGravity.alpha;

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

          const stopRadius = physics.clusterGravity.stopRadiusBase +
            (Math.sqrt(grp.length) * physics.clusterGravity.stopRadiusScale);

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

        if (sSub === tSub) return physics.links.distance.internal;
        if (sL2 && sL2 === tL2) return physics.links.distance.l2Sibling;
        if (sL1 === tL1) return physics.links.distance.l1Sibling;
        return physics.links.distance.external;
      })
      .strength((link: any) => {
        const sSub = link.source.subsystem;
        const tSub = link.target.subsystem;
        const sL1 = link.source._levels ? link.source._levels[0] : null;
        const tL1 = link.target._levels ? link.target._levels[0] : null;

        if (sSub === tSub) return physics.links.strength.internal;
        if (sL1 === tL1) return physics.links.strength.l1Sibling;
        return physics.links.strength.external;
      });

    this.graphInstance.d3Force('charge').strength(physics.charge);
  }
}