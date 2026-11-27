import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GraphStyleService, GraphStyleConfig } from '../../services/graph-style.service';

type Path = (string | number)[];

interface ColorItem { path: Path; label: string; hint?: string }
interface SliderItem { path: Path; label: string; min: number; max: number; step: number }
interface ToggleItem { path: Path; label: string }

interface Section {
  id: string;
  title: string;
  note?: string;
  colors?: ColorItem[];
  swatches?: ColorItem[];
  toggles?: ToggleItem[];
  sliders?: SliderItem[];
}

interface SectionGroup { title: string; sections: Section[] }

const slider = (path: Path, label: string, min: number, max: number, step: number): SliderItem =>
  ({ path, label, min, max, step });

const LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

@Component({
  selector: 'app-graph-style-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './graph-style-panel.html',
  styleUrl: './graph-style-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GraphStylePanelComponent {
  isOpen = false;
  draft: GraphStyleConfig;
  openSections = new Set<string>(['nodeColors']);

  readonly groups: SectionGroup[] = [
    {
      title: 'APPEARANCE',
      sections: [
        {
          id: 'nodeColors',
          title: 'NODE COLORS (BY TYPE)',
          colors: [
            { path: ['nodeColors', 'module'], label: 'Module', hint: 'module, script' },
            { path: ['nodeColors', 'class'], label: 'Class', hint: 'class, controller' },
            { path: ['nodeColors', 'function'], label: 'Function', hint: 'function, utility, directive' },
            { path: ['nodeColors', 'service'], label: 'Service', hint: 'service' },
            { path: ['nodeColors', 'interface'], label: 'Interface', hint: 'interface, model' },
            { path: ['nodeColors', 'default'], label: 'Other', hint: 'anything else' }
          ]
        },
        {
          id: 'levelColors',
          title: 'CLUSTER LEVEL COLORS',
          note: 'Cluster labels, dimmed nodes of the selected cluster, and search matches (L1).',
          swatches: LEVELS.map(l => ({ path: ['levelColors', l], label: `L${l}` }))
        },
        {
          id: 'sizes',
          title: 'NODE SIZES',
          sliders: [
            slider(['sizes', 'default'], 'Default node', 1, 20, 0.2),
            slider(['sizes', 'module'], 'Module node', 1, 20, 0.2),
            slider(['sizes', 'focused'], 'Selected node', 1, 40, 0.5),
            slider(['sizes', 'highlighted'], 'Direct neighbor', 1, 20, 0.2),
            slider(['sizes', 'semiHighlighted'], 'Same cluster', 1, 20, 0.2),
            slider(['sizes', 'searchMatch'], 'Search / cluster match', 1, 30, 0.5),
            slider(['resolution'], 'Sphere detail', 4, 32, 1)
          ]
        },
        {
          id: 'opacities',
          title: 'NODE OPACITY ON SELECTION',
          sliders: [
            slider(['opacities', 'sameCluster'], 'Same cluster', 0, 1, 0.01),
            slider(['opacities', 'sameRoot'], 'Same root cluster', 0, 1, 0.01),
            slider(['opacities', 'unrelated'], 'Unrelated', 0, 1, 0.01)
          ]
        },
        {
          id: 'linkColors',
          title: 'LINK COLORS (BY RELATION)',
          colors: [
            { path: ['linkColors', 'imports'], label: 'Imports', hint: 'imports' },
            { path: ['linkColors', 'calls'], label: 'Calls', hint: 'calls, extends' },
            { path: ['linkColors', 'inherits'], label: 'Inherits', hint: 'inherits, depends_on' },
            { path: ['linkColors', 'uses'], label: 'Uses (docs)', hint: 'dependency found only in docs' },
            { path: ['linkColors', 'default'], label: 'Other', hint: 'anything else' }
          ]
        },
        {
          id: 'links',
          title: 'LINK OPACITY & WIDTH',
          sliders: [
            slider(['linkOpacities', 'idle'], 'Idle opacity', 0, 1, 0.01),
            slider(['linkOpacities', 'focused'], 'Selected node links', 0, 1, 0.01),
            slider(['linkOpacities', 'internalCluster'], 'Inside selected cluster', 0, 1, 0.01),
            slider(['linkOpacities', 'siblingCluster'], 'Between siblings', 0, 1, 0.01),
            slider(['linkOpacities', 'unrelated'], 'Unrelated', 0, 1, 0.01),
            slider(['linkWidths', 'base'], 'Base width', 0.1, 5, 0.1),
            slider(['linkWidths', 'highlighted'], 'Selected width', 0.1, 8, 0.1),
            slider(['linkWidths', 'searchMatch'], 'Search match width', 0.1, 8, 0.1)
          ]
        },
        {
          id: 'particles',
          title: 'LINK PARTICLES',
          sliders: [
            slider(['particles', 'idleCount'], 'Idle count', 0, 10, 1),
            slider(['particles', 'highlightedCount'], 'Selected count', 0, 10, 1),
            slider(['particles', 'searchCount'], 'Search match count', 0, 10, 1),
            slider(['particles', 'width'], 'Width', 0.2, 6, 0.1),
            slider(['particles', 'highlightedWidth'], 'Selected width', 0.2, 6, 0.1),
            slider(['particles', 'speed'], 'Speed', 0, 0.05, 0.001),
            slider(['particles', 'highlightedSpeed'], 'Selected speed', 0, 0.05, 0.001)
          ]
        },
        {
          id: 'labels',
          title: 'LABELS',
          sliders: [
            slider(['labels', 'maxPills'], 'Max node labels', 0, 200, 5),
            slider(['labels', 'pillFontSize'], 'Node label size', 9, 16, 1),
            slider(['labels', 'badgeFontSize'], 'Cluster label size (L1)', 10, 24, 1),
            slider(['labels', 'activeScale'], 'Active level scale', 1, 2, 0.05),
            slider(['labels', 'activeOpacity'], 'Active level opacity', 0, 1, 0.01),
            slider(['labels', 'childOpacity'], 'Inner children opacity', 0, 1, 0.01),
            slider(['labels', 'fadedOpacity'], 'Previous levels opacity', 0, 1, 0.01)
          ]
        },
        {
          id: 'scene',
          title: 'SCENE',
          colors: [
            { path: ['scene', 'background'], label: 'Background' },
            { path: ['scene', 'focusedNodeColor'], label: 'Selected node' }
          ]
        }
      ]
    },
    {
      title: 'PHYSICS & LAYOUT',
      sections: [
        {
          id: 'forces',
          title: 'FORCES',
          note: 'Layout changes re-run the simulation.',
          sliders: [
            slider(['physics', 'charge'], 'Repulsion (charge)', -3000, 0, 50),
            slider(['physics', 'clusterGravity', 'alpha'], 'Cluster gravity', 0, 0.5, 0.01),
            slider(['physics', 'clusterGravity', 'stopRadiusBase'], 'Stop radius base', 0, 600, 10),
            slider(['physics', 'clusterGravity', 'stopRadiusScale'], 'Stop radius scale', 0, 100, 1)
          ]
        },
        {
          id: 'linkPhysics',
          title: 'LINK DISTANCE & STRENGTH',
          sliders: [
            slider(['physics', 'links', 'distance', 'internal'], 'Distance: same cluster', 10, 1000, 10),
            slider(['physics', 'links', 'distance', 'l2Sibling'], 'Distance: L2 siblings', 10, 1000, 10),
            slider(['physics', 'links', 'distance', 'l1Sibling'], 'Distance: L1 siblings', 10, 1500, 10),
            slider(['physics', 'links', 'distance', 'external'], 'Distance: external', 10, 2000, 10),
            slider(['physics', 'links', 'strength', 'internal'], 'Strength: same cluster', 0, 1, 0.01),
            slider(['physics', 'links', 'strength', 'l1Sibling'], 'Strength: L1 siblings', 0, 1, 0.01),
            slider(['physics', 'links', 'strength', 'external'], 'Strength: external', 0, 1, 0.01)
          ]
        },
        {
          id: 'orbits',
          title: 'CLUSTER ORBITS',
          note: 'Radius of each level around its parent: base + √nodes × scale.',
          sliders: [1, 2, 3, 4].flatMap(l => [
            slider(['physics', 'orbits', 'base', l], `L${l} base radius`, 0, 600, 5),
            slider(['physics', 'orbits', 'scale', l], `L${l} scale`, 0, 100, 1)
          ])
        },
        {
          id: 'dag',
          title: 'TREE LAYOUT (DAG)',
          toggles: [{ path: ['dag', 'enabled'], label: 'Enable tree layout' }],
          sliders: [slider(['dag', 'distance'], 'Level distance', 50, 1000, 10)]
        }
      ]
    }
  ];

  constructor(private styleService: GraphStyleService) {
    this.draft = structuredClone(styleService.style);
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  toggleSection(id: string): void {
    this.openSections.has(id) ? this.openSections.delete(id) : this.openSections.add(id);
  }

  get(path: Path): any {
    return path.reduce((obj: any, k) => obj?.[k], this.draft);
  }

  set(path: Path, value: unknown): void {
    const parent = path.slice(0, -1).reduce((obj: any, k) => obj[k], this.draft);
    parent[path[path.length - 1]] = value;
    this.commit();
  }

  /** Push the draft to the service: applies live and persists to localStorage. */
  commit(): void {
    this.styleService.update(structuredClone(this.draft));
  }

  resetAll(): void {
    this.styleService.reset();
    this.draft = structuredClone(this.styleService.style);
  }

  resetSection(section: Section): void {
    const items: { path: Path }[] = [
      ...(section.colors || []),
      ...(section.swatches || []),
      ...(section.toggles || []),
      ...(section.sliders || [])
    ];
    items.forEach(({ path }) => {
      const def = path.reduce((obj: any, k) => obj?.[k], this.styleService.defaults);
      const parent = path.slice(0, -1).reduce((obj: any, k) => obj[k], this.draft);
      parent[path[path.length - 1]] = structuredClone(def);
    });
    this.commit();
  }

  /** Display helper so float steps don't render as 0.30000000000000004. */
  fmt(value: number, step: number): string {
    if (step >= 1) return String(value);
    const decimals = Math.min(3, Math.max(1, -Math.floor(Math.log10(step))));
    return Number(value).toFixed(decimals);
  }

  trackSection(_: number, s: Section): string {
    return s.id;
  }

}
