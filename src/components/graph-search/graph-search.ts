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
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GraphStateService } from '../../services/graph-state.service';
import { GraphNode } from '../../core/graph.model';

@Component({
  selector: 'app-graph-search',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './graph-search.html',
  styleUrl: './graph-search.scss',
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
    this.subscriptions.add(
      this.state.focusedNode$.subscribe(() => {
        this.isDropdownOpen = false;
        this.cdr.markForCheck();
      })
    );
    this.subscriptions.add(
      this.state.focusedCluster$.subscribe(() => {
        this.isDropdownOpen = false;
        this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  onSelectResult(node: GraphNode): void {
    this.isDropdownOpen = false;
    this.query = node.name || this.getShortId(node.id);
    this.state.selectNode(node);
  }

  toggleDropdown(): void {
    if (this.matchedNodes.length > 0) {
      this.isDropdownOpen = !this.isDropdownOpen;
      this.cdr.markForCheck();
    }
  }

  getShortId(id: string): string {
    return id.split('/').pop() || id;
  }
}