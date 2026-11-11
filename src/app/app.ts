import { Component, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { GraphData, GraphNode, GraphConfig } from '../core/graph.model';
import { GraphViewportComponent } from '../components/graph-viewport/graph-viewport';
import { GraphInspectorComponent } from '../components/graph-inspector/graph-inspector';
import { GraphHierarchyService } from '../services/graph-hierarchy.service';
import { GraphStateService } from '../services/graph-state.service';

const getNodeId = (target: string | GraphNode): string => {
  return typeof target === 'object' ? target.id : target;
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    GraphViewportComponent,
    GraphInspectorComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  @ViewChild('viewport', { static: true }) viewport!: GraphViewportComponent;

  stats$: Observable<{ nodes: number; links: number }>;

  constructor(
    private http: HttpClient,
    private state: GraphStateService,
    private hierarchy: GraphHierarchyService
  ) {
    this.stats$ = this.state.graphData$.pipe(
      map(data => ({
        nodes: data?.nodes.length || 0,
        links: data?.links.length || 0
      }))
    );
  }

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
    const primaryUrl = '/data.json';

    this.http.get<GraphData>(primaryUrl).subscribe({
      next: (data) => this.initGraphPayload(data),
      error: () => {
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