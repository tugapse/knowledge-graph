import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { GraphData, ClusterGroup, GraphNode, GraphLink } from '../core/graph.model';

export interface NeighborRelation {
  id: string;
  name: string;
  relation: string;
  dir: 'OUT' | 'IN' | 'SELF';
}

@Injectable({
  providedIn: 'root'
})
export class GraphStateService {
  private graphDataSub = new BehaviorSubject<GraphData | null>(null);
  readonly graphData$: Observable<GraphData | null> = this.graphDataSub.asObservable();

  private clusterGroupsSub = new BehaviorSubject<Record<string, ClusterGroup>>({});
  readonly clusterGroups$: Observable<Record<string, ClusterGroup>> = this.clusterGroupsSub.asObservable();

  private focusedNodeSub = new BehaviorSubject<GraphNode | null>(null);
  readonly focusedNode$: Observable<GraphNode | null> = this.focusedNodeSub.asObservable();

  private focusedClusterSub = new BehaviorSubject<string | null>(null);
  readonly focusedCluster$: Observable<string | null> = this.focusedClusterSub.asObservable();

  private selectionIntensitySub = new BehaviorSubject<number>(0.0);
  readonly selectionIntensity$: Observable<number> = this.selectionIntensitySub.asObservable();

  private highlightNodesSub = new BehaviorSubject<Set<string>>(new Set());
  readonly highlightNodes$: Observable<Set<string>> = this.highlightNodesSub.asObservable();

  private semiHighlightNodesSub = new BehaviorSubject<Set<string>>(new Set());
  readonly semiHighlightNodes$: Observable<Set<string>> = this.semiHighlightNodesSub.asObservable();

  private rootClusterNodesSub = new BehaviorSubject<Set<string>>(new Set());
  readonly rootClusterNodes$: Observable<Set<string>> = this.rootClusterNodesSub.asObservable();

  private highlightLinksSub = new BehaviorSubject<Set<GraphLink>>(new Set());
  readonly highlightLinks$: Observable<Set<GraphLink>> = this.highlightLinksSub.asObservable();

  private searchMatchingNodesSub = new BehaviorSubject<Set<string>>(new Set());
  readonly searchMatchingNodes$: Observable<Set<string>> = this.searchMatchingNodesSub.asObservable();

  private activeNeighborsSub = new BehaviorSubject<NeighborRelation[]>([]);
  readonly activeNeighbors$: Observable<NeighborRelation[]> = this.activeNeighborsSub.asObservable();

  private cameraTargetSub = new BehaviorSubject<{
    pos: { x: number; y: number; z: number };
    lookAt: { x: number; y: number; z: number };
    duration: number;
  } | null>(null);
  readonly cameraTarget$ = this.cameraTargetSub.asObservable();

  get graphData(): GraphData | null {
    return this.graphDataSub.value;
  }

  get clusterGroups(): Record<string, ClusterGroup> {
    return this.clusterGroupsSub.value;
  }

  setGraphData(data: GraphData): void {
    this.graphDataSub.next(data);
  }

  setClusterGroups(groups: Record<string, ClusterGroup>): void {
    this.clusterGroupsSub.next(groups);
  }

  setSelectionIntensity(val: number): void {
    this.selectionIntensitySub.next(val);
  }

  setSearchMatchingNodes(nodes: Set<string>): void {
    this.searchMatchingNodesSub.next(nodes);
  }

  triggerCameraMove(
    pos: { x: number; y: number; z: number },
    lookAt: { x: number; y: number; z: number },
    duration = 1200
  ): void {
    this.cameraTargetSub.next({ pos, lookAt, duration });
  }

  selectNode(node: GraphNode | null): void {
    if (!node) {
      this.clearSelection();
      return;
    }

    const data = this.graphDataSub.value;
    const groups = this.clusterGroupsSub.value;

    const highlights = new Set<string>([node.id]);
    const semiHighlights = new Set<string>();
    const rootCluster = new Set<string>();
    const linkHighlights = new Set<GraphLink>();
    const neighbors: NeighborRelation[] = [];

    if (data) {
      data.links.forEach(link => {
        const sId = typeof link.source === 'object' ? link.source.id : link.source;
        const tId = typeof link.target === 'object' ? link.target.id : link.target;

        if (sId === node.id || tId === node.id) {
          linkHighlights.add(link);
          highlights.add(sId);
          highlights.add(tId);

          const isOut = sId === node.id;
          const otherId = isOut ? tId : sId;
          const otherName = otherId.split('#').pop()?.split('/').pop() || otherId;
          const rel = link.relation || (isOut ? 'targets' : 'source');
          neighbors.push({ id: otherId, name: otherName, relation: rel, dir: isOut ? 'OUT' : 'IN' });
        }
      });
    }

    const levels = node._levels || [node.subsystem || 'CORE'];
    const parentClusterKey = levels.length > 1 ? levels.slice(0, -1).join(' / ') : levels[0];
    const parentCluster = groups[parentClusterKey] || [];
    parentCluster.forEach(sibling => {
      if (!highlights.has(sibling.id)) semiHighlights.add(sibling.id);
    });

    const rootClusterKey = levels[0];
    const rootNodes = groups[rootClusterKey] || [];
    rootNodes.forEach(rNode => {
      if (!highlights.has(rNode.id) && !semiHighlights.has(rNode.id)) {
        rootCluster.add(rNode.id);
      }
    });

    this.focusedNodeSub.next(node);
    this.focusedClusterSub.next(null);
    this.highlightNodesSub.next(highlights);
    this.semiHighlightNodesSub.next(semiHighlights);
    this.rootClusterNodesSub.next(rootCluster);
    this.highlightLinksSub.next(linkHighlights);
    this.searchMatchingNodesSub.next(new Set());
    this.activeNeighborsSub.next(neighbors);
    this.setSelectionIntensity(1.0);

    const nx = node.x || 0;
    const ny = node.y || 0;
    const nz = node.z || 0;
    const distance = 320;
    const distRatio = 1 + distance / (Math.hypot(nx, ny, nz) || 1);

    this.triggerCameraMove(
      { x: nx * distRatio, y: ny * distRatio, z: nz * distRatio },
      { x: nx, y: ny, z: nz },
      1200
    );
  }

  selectCluster(clusterName: string, badgeYOffset: Record<number, number>, baseDistance: Record<number, number>, distanceScale: number): void {
    const grp = this.clusterGroupsSub.value[clusterName];
    if (!grp || grp.length === 0) return;

    const searchMatches = new Set<string>();
    const semiHighlights = new Set<string>();

    const rootName = clusterName.split(' / ')[0];
    const rootGrp = this.clusterGroupsSub.value[rootName] || [];

    grp.forEach(n => searchMatches.add(n.id));
    rootGrp.forEach(n => {
      if (!searchMatches.has(n.id)) semiHighlights.add(n.id);
    });

    this.focusedNodeSub.next(null);
    this.focusedClusterSub.next(clusterName);
    this.highlightNodesSub.next(new Set());
    this.semiHighlightNodesSub.next(semiHighlights);
    this.rootClusterNodesSub.next(new Set());
    this.highlightLinksSub.next(new Set());
    this.searchMatchingNodesSub.next(searchMatches);
    this.activeNeighborsSub.next([]);
    this.setSelectionIntensity(0.9);

    const lvl = grp.level || 1;
    const nodeCount = grp.length;

    let sumX = 0, sumY = 0, sumZ = 0;
    grp.forEach(n => { sumX += n.x || 0; sumY += n.y || 0; sumZ += n.z || 0; });
    const avgX = sumX / nodeCount;
    const avgY = sumY / nodeCount;
    const avgZ = sumZ / nodeCount;

    const targetY = avgY + (badgeYOffset[lvl] || 10);
    const dist = (baseDistance[lvl] || 20) + Math.sqrt(nodeCount) * distanceScale;

    this.triggerCameraMove(
      { x: avgX, y: targetY, z: avgZ + dist },
      { x: avgX, y: targetY, z: avgZ },
      1100
    );
  }

  setSearchResults(matches: GraphNode[]): void {
    this.focusedClusterSub.next(null);
    this.semiHighlightNodesSub.next(new Set());
    this.rootClusterNodesSub.next(new Set());

    const matchIds = new Set(matches.map(m => m.id));
    this.searchMatchingNodesSub.next(matchIds);

    if (this.highlightNodesSub.value.size === 0) {
      this.setSelectionIntensity(matchIds.size > 0 ? 0.85 : 0.0);
    }
  }

  clearSelection(): void {
    this.focusedNodeSub.next(null);
    this.focusedClusterSub.next(null);
    this.highlightNodesSub.next(new Set());
    this.semiHighlightNodesSub.next(new Set());
    this.rootClusterNodesSub.next(new Set());
    this.highlightLinksSub.next(new Set());
    this.searchMatchingNodesSub.next(new Set());
    this.activeNeighborsSub.next([]);
    this.setSelectionIntensity(0.0);
  }

  goBack(): void {
    // Placeholder for navigation history
  }
}