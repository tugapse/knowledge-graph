export interface ColorHexRgb {
  hex: string;
  rgb: string;
}

export interface ColorRgb {
  r: number;
  g: number;
  b: number;
}

export interface GraphNode {
  id: string;
  name?: string;
  group?: string;
  subsystem?: string;
  connectionCount?: number;
  _levels?: string[];
  _tempLevels?: string[];
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  signature?: string;
  semantic_summary?: string;
  keywords?: string[];
  human_overview?: string;
  side_effects?: string;
  raw_markdown?: string;
  [key: string]: any;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relation?: string;
  [key: string]: any;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ClusterGroup extends Array<GraphNode> {
  level?: number;
  shortName?: string;
  parentKey?: string | null;
  targetCenter?: { x: number; y: number; z: number };
}

export interface GraphConfig {
  dag: {
    enabled: boolean;
    mode: string;
    distance: number;
  };
  colors: {
levels: Record<number, ColorHexRgb>;
    nodes: NodeColorMap;
    links: LinkColorMap;
    opacities: {
      nodes: {
        focused: number;
        directNeighbor: number;
        sameCluster: number;
        sameRoot: number;
        unrelated: number;
      };
      links: {
        focused: number;
        internalCluster: number;
        siblingCluster: number;
        unrelated: number;
      };
    };
  };
  physics: {
    orbits: {
      base: Record<number, number>;
      scale: Record<number, number>;
    };
    clusterGravity: {
      alpha: number;
      stopRadiusBase: number;
      stopRadiusScale: number;
    };
    links: {
      distance: {
        internal: number;
        l2Sibling: number;
        l1Sibling: number;
        external: number;
      };
      strength: {
        internal: number;
        l1Sibling: number;
        external: number;
      };
    };
    charge: number;
  };
  camera: {
    badgeYOffset: Record<number, number>;
    baseDistance: Record<number, number>;
    distanceScale: number;
  };
  labels: {
    clusterMaxPills: number;
    globalMaxPills: number;
  };
}
export interface NodeColorMap {
  module: ColorRgb;
  class: ColorRgb;
  function: ColorRgb;
  service: ColorRgb;
  interface: ColorRgb;
  default: ColorRgb;
  [key: string]: ColorRgb;
}

export interface LinkColorMap {
  imports: ColorRgb;
  calls: ColorRgb;
  inherits: ColorRgb;
  default: ColorRgb;
  [key: string]: ColorRgb;
}