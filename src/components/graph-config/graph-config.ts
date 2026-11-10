import { Component, ChangeDetectionStrategy, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GraphConfig } from '../../core/graph.model';
import { DEFAULT_GRAPH_CONFIG } from '../../core/graph.config';

@Component({
  selector: 'app-graph-config',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Toggle Floating Button -->
    <button
      *ngIf="!isOpen"
      type="button"
      class="cfg-toggle-btn"
      (click)="isOpen = true"
    >
       CONFIG
    </button>

    <!-- Tuner Drawer / Modal -->
    <aside *ngIf="isOpen" class="cfg-main-panel">
      <header class="cfg-header">
        <span class="cfg-title">CONFIG TUNER</span>
        <button type="button" class="cfg-close-btn" (click)="isOpen = false">&times;</button>
      </header>

      <div class="cfg-body">
        <label class="cfg-row">
          <span>DAG Mode (Tree Layout)</span>
          <input type="checkbox" [(ngModel)]="localConfig.dag.enabled" />
        </label>

        <label class="cfg-row">
          <span>DAG Level Distance</span>
          <input type="number" class="cfg-input" [(ngModel)]="localConfig.dag.distance" />
        </label>

        <hr class="cfg-divider" />

        <label class="cfg-row" title="Show node labels if cluster size is below this">
          <span>Max Labels (Pills)</span>
          <input type="number" class="cfg-input border-amber" [(ngModel)]="localConfig.labels.clusterMaxPills" />
        </label>

        <label class="cfg-row" title="Limits how far nodes can fly from cluster center">
          <span>Stop Radius Base</span>
          <input type="number" class="cfg-input border-purple" [(ngModel)]="localConfig.physics.clusterGravity.stopRadiusBase" />
        </label>

        <hr class="cfg-divider" />

        <label class="cfg-row">
          <span>Orbit Base (L1)</span>
          <input type="number" class="cfg-input" [(ngModel)]="localConfig.physics.orbits.base[1]" />
        </label>

        <label class="cfg-row">
          <span>Repulsion (Charge)</span>
          <input type="number" class="cfg-input" [(ngModel)]="localConfig.physics.charge" />
        </label>

        <label class="cfg-row">
          <span>Internal Link Dist</span>
          <input type="number" class="cfg-input" [(ngModel)]="localConfig.physics.links.distance.internal" />
        </label>

        <button type="button" class="cfg-apply-btn" (click)="applyChanges()">
          APPLY CHANGES
        </button>
      </div>
    </aside>
  `,
  styles: [`
    :host {
      display: block;
      font-family: 'Inter', sans-serif;
    }
    .cfg-toggle-btn {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 40;
      background: rgba(3, 10, 19, 0.92);
      border: 1px solid #00f0ff;
      color: #00f0ff;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.2);
    }
    .cfg-main-panel {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 50;
      background: rgba(3, 10, 19, 0.95);
      border: 1px solid #00f0ff;
      padding: 15px;
      border-radius: 8px;
      color: #fff;
      width: 290px;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.25);
    }
    .cfg-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .cfg-title {
      font-weight: bold;
      font-size: 12px;
      color: #00f0ff;
    }
    .cfg-close-btn {
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }
    .cfg-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 11px;
    }
    .cfg-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #cbd5e1;
    }
    .cfg-input {
      width: 65px;
      background: #021020;
      border: 1px solid #00f0ff;
      color: #fff;
      border-radius: 3px;
      padding: 3px 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      text-align: right;
    }
    .border-amber { border-color: #fbbf24; }
    .border-purple { border-color: #a855f7; }
    .cfg-divider {
      border: none;
      border-top: 1px solid rgba(0, 240, 255, 0.2);
      margin: 4px 0;
    }
    .cfg-apply-btn {
      margin-top: 8px;
      background: #00f0ff;
      color: #030a13;
      border: none;
      padding: 7px;
      font-weight: bold;
      cursor: pointer;
      border-radius: 4px;
      font-size: 11px;
      transition: background 0.15s ease;
    }
    .cfg-apply-btn:hover {
      background: #38bdf8;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphConfigComponent {
  @Output() configChange = new EventEmitter<GraphConfig>();

  isOpen = false;
  localConfig: GraphConfig = JSON.parse(JSON.stringify(DEFAULT_GRAPH_CONFIG));

  applyChanges(): void {
    this.localConfig.labels.globalMaxPills = this.localConfig.labels.clusterMaxPills;
    this.configChange.emit(this.localConfig);
  }
}