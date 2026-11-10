import { Injectable } from '@angular/core';
import { 
  GraphNode, 
  GraphLink, 
  GraphConfig, 
  ClusterGroup, 
  ColorRgb, 
  ColorHexRgb 
} from '../models/graph.model';
import { DEFAULT_GRAPH_CONFIG } from '../config/graph.config';

@Injectable({
  providedIn: 'root'
})
export class GraphHierarchyService {
  private config: GraphConfig = DEFAULT_GRAPH_CONFIG;

  setConfig(config: GraphConfig): void {
    this.config = config;
  }

  parseNodeLevels(node: GraphNode | null): string[] {
    if (!node) return ['CORE'];
    const rawId = String(node.id || '').trim();
    if (!rawId) return ['EXTERNAL'];

    if (rawId.startsWith('@external/')) {
      return ['EXTERNAL'];
    }

    const parts = rawId.split(/[\/#]/).filter(Boolean);
    while (parts.length > 1 && ['SRC'].includes(parts[0].toUpperCase())) {
      parts.shift();
    }

    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      if (/\.[a-z0-9]+$/i.test(lastPart) || lastPart.toLowerCase() === 'ts') {
        parts.pop();
      }
    }

    const cleanParts = parts
      .map(p => p.toUpperCase().replace(/\.(SPEC|COMPONENT|SERVICE|DIRECTIVE|MODEL|MODELS|INTERFACE|ENUM|HELPER|BEHAVIOUR)?\.?(TS|JS|HTML|SCSS|MD|FRAG|VERT|D)$/i, ''))
      .filter(Boolean);

    if (cleanParts.length === 0) return ['CORE'];
    return cleanParts.slice(0, 10);
  }

  buildClusterGroups(nodes: GraphNode[]): Record<string, ClusterGroup> {
    const clusterGroups: Record<string, ClusterGroup> = {};
    const hierarchy: Record<string, any> = {};

    nodes.forEach(node => {
      node._tempLevels = this.parseNodeLevels(node);
    });

    let collapsing = true;
    while (collapsing) {
      collapsing = false;
      const pathCounts: Record<string, number> = {};

      nodes.forEach(n => {
        const path = (n._tempLevels || []).join(' / ');
        pathCounts[path] = (pathCounts[path] || 0) + 1;
      });

      nodes.forEach(n => {
        const path = (n._tempLevels || []).join(' / ');
        if (pathCounts[path] === 1) {
          if (n._tempLevels && n._tempLevels.length === 1 && n._tempLevels[0] === 'CORE') return;
          n._tempLevels?.pop();
          if (n._tempLevels && n._tempLevels.length === 0) n._tempLevels = ['CORE'];
          collapsing = true;
        }
      });
    }

    nodes.forEach(node => {
      const levels = node._tempLevels || ['CORE'];
      node._levels = levels;

      const leafKey = levels.join(' / ');
      node.subsystem = leafKey;
      node.connectionCount = 0;

      for (let i = 1; i <= levels.length; i++) {
        const key = levels.slice(0, i).join(' / ');
        if (!clusterGroups[key]) {
          const arr = [] as unknown as ClusterGroup;
          arr.level = i;
          arr.shortName = levels[i - 1];
          arr.parentKey = i > 1 ? levels.slice(0, i - 1).join(' / ') : null;
          clusterGroups[key] = arr;
        }
        clusterGroups[key].push(node);
      }

      let currentObj = hierarchy;
      levels.forEach(lvl => {
        if (!currentObj[lvl]) {
          currentObj[lvl] = {};
        }
        currentObj = currentObj[lvl];
      });
    });

    this.calculateClusterCenters(clusterGroups, hierarchy);
    return clusterGroups;
  }

  calculateClusterCenters(
    clusterGroups: Record<string, ClusterGroup>,
    hierarchyObj: Record<string, any>,
    parentCenter = { x: 0, y: 0, z: 0 },
    currentLevel = 1,
    currentPath = '',
    parentAngle = 0
  ): void {
    if (this.config.dag.enabled) return;

    const keys = Object.keys(hierarchyObj).filter(Boolean);
    keys.forEach((key, i) => {
      const fullPath = currentPath ? `${currentPath} / ${key}` : key;
      const nodeCount = clusterGroups[fullPath] ? clusterGroups[fullPath].length : 1;

      const baseR = this.config.physics.orbits.base[currentLevel] || 10;
      const scaleR = this.config.physics.orbits.scale[currentLevel] || 2;
      const r = baseR + Math.sqrt(nodeCount) * scaleR;

      const a = parentAngle + (2 * Math.PI * i) / keys.length;
      const yOffset = currentLevel === 1 ? (80 + Math.sqrt(nodeCount) * 10) : (50 / (currentLevel - 1));

      const c = {
        x: parentCenter.x + r * Math.cos(a),
        y: parentCenter.y + ((i % 2 === 0 ? 1 : -1) * yOffset),
        z: parentCenter.z + r * Math.sin(a)
      };

      if (clusterGroups[fullPath]) {
        clusterGroups[fullPath].targetCenter = c;
      }

      if (typeof hierarchyObj[key] === 'object' && Object.keys(hierarchyObj[key]).length > 0) {
        this.calculateClusterCenters(clusterGroups, hierarchyObj[key], c, currentLevel + 1, fullPath, a);
      }
    });
  }

  getNodeBaseColor(node: GraphNode): ColorRgb {
    const grp = (node.group || '').toLowerCase();
    if (grp === 'module' || grp === 'script') return this.config.colors.nodes.module;
    if (grp === 'class' || grp === 'controller') return this.config.colors.nodes.class;
    if (grp === 'function' || grp === 'utility' || grp === 'directive') return this.config.colors.nodes.function;
    if (grp === 'service') return this.config.colors.nodes.service;
    if (grp === 'interface' || grp === 'model') return this.config.colors.nodes.interface;
    return this.config.colors.nodes.default;
  }

  getLinkBaseColor(link: GraphLink): ColorRgb {
    const rel = (link.relation || '').toLowerCase();
    if (rel === 'imports') return this.config.colors.links.imports;
    if (rel === 'calls' || rel === 'extends') return this.config.colors.links.calls;
    if (rel === 'inherits' || rel === 'depends_on') return this.config.colors.links.inherits;
    return this.config.colors.links.default;
  }

  getLevelColor(node: GraphNode): ColorHexRgb {
    const lvl = (node._levels || []).length;
    return this.config.colors.levels[lvl] || this.config.colors.levels[10];
  }
}