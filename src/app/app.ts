import { Component, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { GraphStateService } from './core/services/graph-state.service';
import { GraphHierarchyService } from './core/services/graph-hierarchy.service';
import { GraphViewportComponent } from './core/components/graph-viewport/graph-viewport.component';
import { GraphData, GraphConfig, GraphNode } from './core/models/graph.model';

const getNodeId = (target: string | GraphNode): string => {
  return typeof target === 'object' ? target.id : target;
};

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  @ViewChild('viewport', { static: true }) viewport!: GraphViewportComponent;

  readonly stats$: Observable<{ nodes: number; links: number }> = this.state.graphData$.pipe(
    map(data => ({
      nodes: data?.nodes.length || 0,
      links: data?.links.length || 0
    }))
  );

  constructor(
    private http: HttpClient,
    private state: GraphStateService,
    private hierarchy: GraphHierarchyService
  ) {}

  ngOnInit(): void {
    this.loadGraphData();
  }

  onResetCamera(): void {
    this.state.triggerCameraMove(
      { x: 0, y: 0, z: 950 },
      { x: 0, y: 0, z: 0 },
      1500
    );
  }

  onConfigChanged(newConfig: GraphConfig): void {
    this.hierarchy.setConfig(newConfig);

    const currentData = this.state.graphData;
    if (currentData) {
      const updatedClusters = this.hierarchy.buildClusterGroups(currentData.nodes);
      this.state.setClusterGroups(updatedClusters);
    }

    this.viewport.applyPhysicsSettings();
  }

  private loadGraphData(): void {
    const isStaticHost = window.location.pathname.endsWith('.html') || window.location.protocol === 'file:';
    const primaryUrl = isStaticHost ? './assets/data.json' : 'assets/data.json';

    this.http.get<GraphData>(primaryUrl).subscribe({
      next: (data) => this.initGraphPayload(data),
      error: () => {
        // Fallback endpoint
        this.http.get<GraphData>('/api/data').subscribe({
          next: (data) => this.initGraphPayload(data),
          error: (err) => console.error('Failed to load graph data payload:', err)
        });
      }
    });
  }

  private initGraphPayload(data: GraphData): void {
    data.nodes.forEach(n => (n.connectionCount = 0));

    data.links.forEach(l => {
      const sId = getNodeId(l.source);
      const tId = getNodeId(l.target);
      const sNode = data.nodes.find(n => n.id === sId);
      const tNode = data.nodes.find(n => n.id === tId);

      if (sNode) sNode.connectionCount = (sNode.connectionCount || 0) + 1;
      if (tNode) tNode.connectionCount = (tNode.connectionCount || 0) + 1;
    });

    const clusterGroups = this.hierarchy.buildClusterGroups(data.nodes);
    this.state.setClusterGroups(clusterGroups);
    this.state.setGraphData(data);
  }
}