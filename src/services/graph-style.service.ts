import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { DEFAULT_GRAPH_CONFIG } from '../core/graph.config';
import { ColorHexRgb, ColorRgb, GraphConfig } from '../core/graph.model';

export type NodeTypeKey = 'module' | 'class' | 'function' | 'service' | 'interface' | 'default';
export type LinkTypeKey = 'imports' | 'calls' | 'inherits' | 'uses' | 'default';

/**
 * Every user-tunable setting of the graph: appearance (nodes, links, labels, scene)
 * plus physics/layout. Colors are stored as hex. Persisted to localStorage.
 */
export interface GraphStyleConfig {
  scene: {
    background: string;
    focusedNodeColor: string;
  };
  nodeColors: Record<NodeTypeKey, string>;
  levelColors: Record<number, string>;
  sizes: {
    focused: number;
    highlighted: number;
    semiHighlighted: number;
    searchMatch: number;
    module: number;
    default: number;
  };
  resolution: number;
  opacities: {
    sameCluster: number;
    sameRoot: number;
    unrelated: number;
  };
  linkColors: Record<LinkTypeKey, string>;
  linkOpacities: {
    idle: number;
    focused: number;
    internalCluster: number;
    siblingCluster: number;
    unrelated: number;
  };
  linkWidths: {
    base: number;
    highlighted: number;
    searchMatch: number;
  };
  particles: {
    idleCount: number;
    highlightedCount: number;
    searchCount: number;
    width: number;
    highlightedWidth: number;
    speed: number;
    highlightedSpeed: number;
  };
  labels: {
    pillFontSize: number;
    badgeFontSize: number;
    activeScale: number;
    activeOpacity: number;
    childOpacity: number;
    fadedOpacity: number;
    maxPills: number;
  };
  dag: GraphConfig['dag'];
  physics: GraphConfig['physics'];
}

/** @deprecated kept for older imports; use GraphStyleConfig. */
export type NodeStyleConfig = GraphStyleConfig;

const STORAGE_KEY = 'kg.nodeStyle.v2';
/** Older saves: everything carries over except link opacity/width, whose defaults got brighter. */
const LEGACY_STORAGE_KEYS = ['kg.nodeStyle.v1'];

const rgbToHex = ({ r, g, b }: ColorRgb): string =>
  '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');

export const hexToRgb = (hex: string): ColorRgb => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x64748b;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};

function buildDefaults(): GraphStyleConfig {
  const c = DEFAULT_GRAPH_CONFIG.colors;
  const levelColors: Record<number, string> = {};
  Object.entries(c.levels).forEach(([lvl, col]) => (levelColors[+lvl] = col.hex));

  return {
    scene: { background: '#030a13', focusedNodeColor: '#ffffff' },
    nodeColors: {
      module: rgbToHex(c.nodes.module),
      class: rgbToHex(c.nodes.class),
      function: rgbToHex(c.nodes.function),
      service: rgbToHex(c.nodes.service),
      interface: rgbToHex(c.nodes.interface),
      default: rgbToHex(c.nodes.default)
    },
    levelColors,
    sizes: { focused: 14, highlighted: 7, semiHighlighted: 5.2, searchMatch: 10, module: 7, default: 3.8 },
    resolution: 18,
    opacities: {
      sameCluster: c.opacities.nodes.sameCluster,
      sameRoot: c.opacities.nodes.sameRoot,
      unrelated: c.opacities.nodes.unrelated
    },
    linkColors: {
      imports: rgbToHex(c.links.imports),
      calls: rgbToHex(c.links.calls),
      inherits: rgbToHex(c.links.inherits),
      uses: '#f472b6',
      default: rgbToHex(c.links.default)
    },
    linkOpacities: {
      idle: 0.5,
      focused: 1,
      internalCluster: 0.8,
      siblingCluster: 0.4,
      unrelated: 0.14
    },
    linkWidths: { base: 1.2, highlighted: 3, searchMatch: 1.8 },
    particles: {
      idleCount: 2,
      highlightedCount: 4,
      searchCount: 2,
      width: 1.5,
      highlightedWidth: 2.5,
      speed: 0.005,
      highlightedSpeed: 0.012
    },
    labels: {
      pillFontSize: 13,
      badgeFontSize: 14,
      activeScale: 1.2,
      activeOpacity: 1.0,
      childOpacity: 0.88,
      fadedOpacity: 0.4,
      maxPills: DEFAULT_GRAPH_CONFIG.labels.clusterMaxPills
    },
    dag: structuredClone(DEFAULT_GRAPH_CONFIG.dag),
    physics: structuredClone(DEFAULT_GRAPH_CONFIG.physics)
  };
}

/** Deep-merge saved values over defaults so settings added later still get a value. */
function mergeDeep<T>(base: T, patch: unknown): T {
  if (typeof base !== 'object' || base === null || typeof patch !== 'object' || patch === null) {
    return (patch !== undefined && typeof patch === typeof base ? patch : base) as T;
  }
  const out: any = { ...base };
  Object.keys(base as object).forEach(k => {
    out[k] = mergeDeep((base as any)[k], (patch as any)[k]);
  });
  return out;
}

@Injectable({ providedIn: 'root' })
export class GraphStyleService {
  readonly defaults = buildDefaults();

  private styleSub = new BehaviorSubject<GraphStyleConfig>(this.load());
  readonly style$: Observable<GraphStyleConfig> = this.styleSub.asObservable();

  // Resolved (rgb) caches, rebuilt on every change — read in hot render paths.
  private nodeRgb!: Record<NodeTypeKey, ColorRgb>;
  private linkRgb!: Record<LinkTypeKey, ColorRgb>;
  private levelHexRgb!: Record<number, ColorHexRgb>;

  constructor() {
    this.resolve(this.styleSub.value);
  }

  get style(): GraphStyleConfig {
    return this.styleSub.value;
  }

  update(next: GraphStyleConfig): void {
    this.resolve(next);
    this.styleSub.next(next);
    this.save(next);
  }

  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    } catch {
      /* storage unavailable */
    }
    const fresh = buildDefaults();
    this.resolve(fresh);
    this.styleSub.next(fresh);
  }

  nodeColor(type: NodeTypeKey): ColorRgb {
    return this.nodeRgb[type];
  }

  linkColor(type: LinkTypeKey): ColorRgb {
    return this.linkRgb[type];
  }

  levelColor(level: number): ColorHexRgb {
    return this.levelHexRgb[level] || this.levelHexRgb[10];
  }

  private resolve(s: GraphStyleConfig): void {
    this.nodeRgb = {} as Record<NodeTypeKey, ColorRgb>;
    (Object.keys(s.nodeColors) as NodeTypeKey[]).forEach(k => (this.nodeRgb[k] = hexToRgb(s.nodeColors[k])));

    this.linkRgb = {} as Record<LinkTypeKey, ColorRgb>;
    (Object.keys(s.linkColors) as LinkTypeKey[]).forEach(k => (this.linkRgb[k] = hexToRgb(s.linkColors[k])));

    this.levelHexRgb = {};
    Object.entries(s.levelColors).forEach(([lvl, hex]) => {
      const { r, g, b } = hexToRgb(hex);
      this.levelHexRgb[+lvl] = { hex, rgb: `${r}, ${g}, ${b}` };
    });
  }

  private load(): GraphStyleConfig {
    const defaults = buildDefaults();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return mergeDeep(defaults, JSON.parse(raw));
      for (const key of LEGACY_STORAGE_KEYS) {
        const legacy = localStorage.getItem(key);
        if (!legacy) continue;
        const parsed = JSON.parse(legacy);
        delete parsed.linkOpacities;
        delete parsed.linkWidths;
        const migrated = mergeDeep(defaults, parsed);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(key);
        return migrated;
      }
      return defaults;
    } catch {
      return defaults;
    }
  }

  private save(s: GraphStyleConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      /* storage unavailable or full — style still applies for this session */
    }
  }
}
