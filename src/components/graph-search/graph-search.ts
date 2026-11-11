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
import { GraphHierarchyService } from '../../services/graph-hierarchy.service';
import { GraphNode } from '../../core/graph.model';

const MAX_RESULTS = 30;
const PLACEHOLDER_GROUP = 'External/Dependency';

interface TextPart { text: string; hit: boolean }

export interface SearchResult {
  node: GraphNode;
  score: number;
  nameParts: TextPart[];
  /** Which field matched when it isn't the name/path (shown as a hint). */
  matchedOn: 'keyword' | 'summary' | 'type' | 'cluster' | null;
  color: string;
  cluster: string;
}

/** Splits `text` into highlighted / plain parts for every occurrence of `q`. */
export function highlight(text: string, q: string): TextPart[] {
  if (!q) return [{ text, hit: false }];
  const parts: TextPart[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const at = lower.indexOf(q, i);
    if (at === -1) {
      parts.push({ text: text.slice(i), hit: false });
      break;
    }
    if (at > i) parts.push({ text: text.slice(i, at), hit: false });
    parts.push({ text: text.slice(at, at + q.length), hit: true });
    i = at + q.length;
  }
  return parts;
}

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
  @ViewChild('resultsRef') resultsRef?: ElementRef<HTMLDivElement>;

  query = '';
  isOpen = false;
  isFocused = false;
  results: SearchResult[] = [];
  totalMatches = 0;
  activeIndex = 0;

  private allNodes: GraphNode[] = [];
  private subscriptions = new Subscription();

  constructor(
    private state: GraphStateService,
    private hierarchy: GraphHierarchyService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.state.graphData$.subscribe(data => {
        this.allNodes = data?.nodes || [];
      })
    );
    // Close only when something is actually selected. (Search itself resets the focused
    // cluster to null, which previously closed the dropdown the moment it opened.)
    this.subscriptions.add(
      this.state.focusedNode$.subscribe(node => node && this.close())
    );
    this.subscriptions.add(
      this.state.focusedCluster$.subscribe(cluster => cluster && this.close())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  @HostListener('window:keydown', ['$event'])
  handleGlobalKeys(e: KeyboardEvent): void {
    const input = this.searchInput?.nativeElement;
    const typingElsewhere = e.target instanceof HTMLInputElement && e.target !== input;
    if (((e.key === '/' && document.activeElement !== input) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) && !typingElsewhere) {
      e.preventDefault();
      input?.focus();
      input?.select();
      return;
    }
    if (e.key === 'Escape') {
      if (this.isOpen) {
        this.close();
        input?.blur();
      } else if (document.activeElement !== input) {
        this.state.clearSelection();
      }
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:mousedown', ['$event'])
  onDocumentMouseDown(e: MouseEvent): void {
    if (this.containerRef && !this.containerRef.nativeElement.contains(e.target as Node)) {
      this.close();
    }
  }

  onInputKeydown(e: KeyboardEvent): void {
    if (!this.results.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      this.isOpen = true;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex = (this.activeIndex + step + this.results.length) % this.results.length;
      this.scrollActiveIntoView();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = this.results[this.activeIndex];
      if (pick) this.select(pick.node);
    }
  }

  onInput(e: Event): void {
    this.query = (e.target as HTMLInputElement).value;
    this.runSearch();
  }

  onFocus(): void {
    this.isFocused = true;
    if (this.results.length) this.isOpen = true;
  }

  onBlur(): void {
    this.isFocused = false;
  }

  clear(): void {
    this.query = '';
    if (this.searchInput) this.searchInput.nativeElement.value = '';
    this.runSearch();
    this.searchInput?.nativeElement.focus();
  }

  select(node: GraphNode): void {
    this.state.selectNode(node);
    this.close();
    this.searchInput?.nativeElement.blur();
  }

  setActive(i: number): void {
    this.activeIndex = i;
  }

  trackResult(_: number, r: SearchResult): string {
    return r.node.id;
  }

  private close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  private runSearch(): void {
    const q = this.query.trim().toLowerCase();
    if (!q) {
      this.results = [];
      this.totalMatches = 0;
      this.isOpen = false;
      this.state.setSearchResults([]);
      this.cdr.markForCheck();
      return;
    }

    const scored: SearchResult[] = [];
    for (const node of this.allNodes) {
      const r = this.score(node, q);
      if (r) scored.push(r);
    }
    scored.sort((a, b) => b.score - a.score || (a.node.name || a.node.id).localeCompare(b.node.name || b.node.id));

    this.totalMatches = scored.length;
    this.results = scored.slice(0, MAX_RESULTS);
    this.activeIndex = 0;
    this.isOpen = true;
    this.state.setSearchResults(scored.map(s => s.node));
    this.cdr.markForCheck();
    this.scrollActiveIntoView();
  }

  /** Name hits rank above path hits, which rank above keyword / summary hits. */
  private score(node: GraphNode, q: string): SearchResult | null {
    const name = (node.name || node.id.split('/').pop() || node.id);
    const lname = name.toLowerCase();
    const id = node.id.toLowerCase();

    let score = 0;
    let matchedOn: SearchResult['matchedOn'] = null;

    if (lname === q) score = 100;
    else if (lname.startsWith(q)) score = 80;
    else if (lname.includes(q)) score = 60;
    else if (id.includes(q)) score = 45;
    else if ((node.keywords || []).some(k => k.toLowerCase().includes(q))) { score = 30; matchedOn = 'keyword'; }
    else if ((node.group || '').toLowerCase().includes(q)) { score = 25; matchedOn = 'type'; }
    else if ((node.subsystem || '').toLowerCase().includes(q)) { score = 20; matchedOn = 'cluster'; }
    else if ((node.semantic_summary || '').toLowerCase().includes(q)) { score = 10; matchedOn = 'summary'; }
    else return null;

    if (node.group === PLACEHOLDER_GROUP) score -= 15; // real documented nodes first
    if (node.raw_markdown) score += 2;

    const c = this.hierarchy.getNodeBaseColor(node);
    return {
      node,
      score,
      matchedOn,
      nameParts: highlight(name, q),
      color: `rgb(${c.r}, ${c.g}, ${c.b})`,
      cluster: (node._levels || [node.subsystem || '']).join(' / ')
    };
  }

  private scrollActiveIntoView(): void {
    requestAnimationFrame(() => {
      const list = this.resultsRef?.nativeElement;
      const el = list?.querySelector<HTMLElement>(`[data-index="${this.activeIndex}"]`);
      if (!list || !el) return;
      if (el.offsetTop < list.scrollTop) list.scrollTop = el.offsetTop;
      else if (el.offsetTop + el.offsetHeight > list.scrollTop + list.clientHeight) {
        list.scrollTop = el.offsetTop + el.offsetHeight - list.clientHeight;
      }
    });
    this.cdr.markForCheck();
  }
}
