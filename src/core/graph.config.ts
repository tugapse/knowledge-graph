import { GraphConfig } from "./graph.model";


export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  dag: {
    enabled: false,
    mode: 'radialout',
    distance: 350
  },
  colors: {
    levels: {
      1: { hex: '#00f0ff', rgb: '0, 240, 255' },    // L1: Cyan
      2: { hex: '#a855f7', rgb: '168, 85, 247' },   // L2: Purple
      3: { hex: '#fbbf24', rgb: '251, 191, 36' },   // L3: Amber
      4: { hex: '#ec4899', rgb: '236, 72, 153' },   // L4: Pink
      5: { hex: '#22c55e', rgb: '34, 197, 94' },    // L5: Green
      6: { hex: '#f97316', rgb: '249, 115, 22' },   // L6: Orange
      7: { hex: '#3b82f6', rgb: '59, 130, 246' },   // L7: Blue
      8: { hex: '#ef4444', rgb: '239, 68, 68' },    // L8: Red
      9: { hex: '#14b8a6', rgb: '20, 184, 166' },   // L9: Teal
      10: { hex: '#6366f1', rgb: '99, 102, 241' }   // L10: Indigo
    },
    nodes: {
      module: { r: 0, g: 240, b: 255 },
      class: { r: 168, g: 85, b: 247 },
      function: { r: 0, g: 255, b: 170 },
      service: { r: 255, g: 170, b: 0 },
      interface: { r: 56, g: 189, b: 248 },
      default: { r: 100, g: 116, b: 139 }
    },
    links: {
      imports: { r: 168, g: 85, b: 247 },
      calls: { r: 0, g: 255, b: 170 },
      inherits: { r: 255, g: 170, b: 0 },
      default: { r: 0, g: 240, b: 255 }
    },
    opacities: {
      nodes: {
        focused: 1.0,
        directNeighbor: 1.0,
        sameCluster: 0.55,
        sameRoot: 0.20,
        unrelated: 0.08
      },
      links: {
        focused: 0.95,
        internalCluster: 0.45,
        siblingCluster: 0.15,
        unrelated: 0.05
      }
    }
  },
  physics: {
    orbits: {
      base:  { 1: 180, 2: 120, 3: 70, 4: 50, 5: 35, 6: 25, 7: 20, 8: 15, 9: 10, 10: 5 },
      scale: { 1: 35,  2: 20,  3: 15, 4: 10, 5: 8,  6: 6,  7: 5,  8: 4,  9: 3,  10: 2 }
    },
    clusterGravity: {
      alpha: 0.08,
      stopRadiusBase: 150,
      stopRadiusScale: 20
    },
    links: {
      distance: { internal: 140, l2Sibling: 220, l1Sibling: 350, external: 550 },
      strength: { internal: 0.15, l1Sibling: 0.09, external: 0.01 }
    },
    charge: -800
  },
  camera: {
    badgeYOffset: { 1: 75, 2: 50, 3: 35, 4: 25, 5: 20, 6: 15, 7: 12, 8: 10, 9: 8, 10: 5 },
    baseDistance: { 1: 580, 2: 340, 3: 180, 4: 120, 5: 90, 6: 70, 7: 50, 8: 40, 9: 30, 10: 20 },
    distanceScale: 25
  },
  labels: {
    clusterMaxPills: 40,
    globalMaxPills: 40
  }
};