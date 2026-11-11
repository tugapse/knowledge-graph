import { Component, OnInit, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { GraphData } from '../core/graph.model';
import { GraphViewportComponent } from '../components/graph-viewport/graph-viewport';
import { GraphInspectorComponent } from '../components/graph-inspector/graph-inspector';
import { GraphHierarchyService } from '../services/graph-hierarchy.service';
import { GraphStateService } from '../services/graph-state.service';
import { countConnections, normalizeGraphData } from '../core/graph-normalize';

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


  private loadGraphData(): void {
    // Relative URLs so the static bundle works from any sub-path (and behind the dev proxy).
    const primaryUrl = 'data.json';

    this.http.get<GraphData>(primaryUrl).subscribe({
      next: (data) => this.initGraphPayload(data),
      error: () => {
        this.http.get<GraphData>('api/data').subscribe({
          next: (data) => this.initGraphPayload(data),
          error: (err) => console.error('Failed to load graph data payload:', err)
        });
      }
    });
  }

  private initGraphPayload(data: GraphData): void {
    const report = normalizeGraphData(data);
    console.info(
      `[graph] merged ${report.mergedDuplicates} duplicate nodes, added ${report.addedDocLinks} doc dependencies` +
        (report.unresolvedDocRefs.length ? `, ${report.unresolvedDocRefs.length} doc refs not in graph` : '')
    );

    const clusterGroups = this.hierarchy.buildClusterGroups(data.nodes);
    countConnections(data);
    this.state.setClusterGroups(clusterGroups);
    this.state.setGraphData(data);
  }
}