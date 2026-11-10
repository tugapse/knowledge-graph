import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  HostListener,
  ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import { GraphStateService } from '../../services/graph-state.service';
import { GraphNode } from '../../core/graph.model';

@Component({
  selector: 'app-graph-search',
  template: `
    <div class="search-container" #containerRef>
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input
          #searchInput
          type="text"
          class="search-input"
          placeholder="Search components or press /"
          [value]="query"
          (input)="onInputChange($event)"
        />
        <span class="search-hint">Ctrl+K</span>
      </div>

      <div *ngIf="isDropdownOpen" class="search-results-dropdown">
        <div *ngIf="matchedNodes.length === 0" class="no-results">
          No components or keywords matching "{{ query }}"
        </div>

        <div
          *ngFor="let node of matchedNodes"
          class="search-result-item"
          (click)="onSelectResult(node)"
        >
          <div class="search-item-header">
            <span class="search-item-title">{{ node.name || getShortId(node.id) }}</span>
            <span class="search-item-type">{{ node.group || 'unknown' }}</span>
          </div>
          <div class="search-item-path">{{ node.id }}</div>
          <div *ngIf="node.semantic_summary" class="search-item-summary">
            {{ node.semantic_summary }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      top: 16px;
      left: 16px;
      z-index: 30;
      width: 320px;
      font-family: 'Inter', sans-serif;
    }
    .search-container {
      position: relative;
      width: 100%;
    }
    .search-input-wrapper {
      display: flex;
      align-items: center;
      background: rgba(3, 10, 19, 0.9);
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 6px;
      padding: 6px 10px;
      box-shadow: 0 0 15px rgba(0, 0, 0, 0.5);
    }
    .search-icon {
      font-size: 12px;
      margin-right: 8px;
      opacity: 0.7;
    }
    .search-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-size: 12px;
      font-family: inherit;
    }
    .search-hint {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      border: 1px solid rgba(148, 163, 184, 0.3);
      padding: 2px 4px;
      border-radius: 3px;
    }
    .search-results-dropdown {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      width: 100%;
      max-height: 380px;
      overflow-y: auto;
      background: rgba(3, 10, 19, 0.95);
      border: 1px solid rgba(0, 240, 255, 0.3);
      border-radius: 6px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8);
      display: flex;
      flex-direction: column;
    }
    .no-results {
      padding: 12px;
      color: #64748b;
      font-size: 11px;
      font-style: italic;
    }
    .search-result-item {
      padding: 10px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .search-result-item:hover {
      background: rgba(0, 240, 255, 0.1);
    }
    .search-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .search-item-title {
      font-size: 12px;
      font-weight: 600;
      color: #00f0ff;
    }
    .search-item-type {
      font-size: 10px;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .search-item-path {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #64748b;
      word-break: break-all;
    }
    .search-item-summary {
      font-size: 11px;
      color: #cbd5e1;
      margin-top: 4px;
      line-height: 1.3;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphSearchComponent implements OnInit, OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('containerRef') containerRef!: ElementRef<HTMLDivElement>;

  query = '';
  isDropdownOpen = false;
  matchedNodes: GraphNode[] = [];

  private allNodes: GraphNode[] = [];
  private subscriptions = new Subscription();

  constructor(
    private state: GraphStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.state.graphData$.subscribe(data => {
        this.allNodes = data?.nodes || [];
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(e: KeyboardEvent): void {
    if (e.key === '/' && document.activeElement !== this.searchInput?.nativeElement) {
      e.preventDefault();
      this.searchInput?.nativeElement.focus();
      this.searchInput?.nativeElement.select();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.searchInput?.nativeElement.focus();
      this.searchInput?.nativeElement.select();
    } else if (e.key === 'Escape') {
      if (this.isDropdownOpen) {
        this.isDropdownOpen = false;
        this.searchInput?.nativeElement.blur();
      } else {
        this.state.clearSelection();
      }
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (this.containerRef && !this.containerRef.nativeElement.contains(e.target as Node)) {
      this.isDropdownOpen = false;
      this.cdr.markForCheck();
    }
  }

  onInputChange(e: Event): void {
    const val = (e.target as HTMLInputElement).value.trim().toLowerCase();
    this.query = val;

    if (!val) {
      this.isDropdownOpen = false;
      this.matchedNodes = [];
      this.state.setSearchResults([]);
      return;
    }

    const matches = this.allNodes.filter(n => {
      const idMatch = (n.id || '').toLowerCase().includes(val);
      const nameMatch = (n.name || '').toLowerCase().includes(val);
      const groupMatch = (n.group || '').toLowerCase().includes(val);
      const subMatch = (n.subsystem || '').toLowerCase().includes(val);
      const summaryMatch = (n.semantic_summary || '').toLowerCase().includes(val);
      const keywordMatch = (n.keywords || []).some(k => k.toLowerCase().includes(val));
      return idMatch || nameMatch || groupMatch || subMatch || summaryMatch || keywordMatch;
    });

    this.matchedNodes = matches.slice(0, 15);
    this.isDropdownOpen = true;
    this.state.setSearchResults(matches);
  }

  onSelectResult(node: GraphNode): void {
    this.isDropdownOpen = false;
    this.query = node.name || this.getShortId(node.id);
    this.state.selectNode(node);
  }

  getShortId(id: string): string {
    return id.split('/').pop() || id;
  }
}