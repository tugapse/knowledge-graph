import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { GraphViewportComponent } from './graph-viewport';

vi.mock('3d-force-graph', () => {
  const createMockInstance = () => {
    const mockInstance: any = {};
    const chainableMethods = [
      'backgroundColor',
      'warmupTicks',
      'cooldownTime',
      'd3VelocityDecay',
      'd3AlphaDecay',
      'enableNodeDrag',
      'nodeResolution',
      'nodeLabel',
      'nodeColor',
      'nodeVal',
      'linkColor',
      'linkWidth',
      'linkDirectionalParticles',
      'linkDirectionalParticleColor',
      'linkDirectionalParticleWidth',
      'linkDirectionalParticleSpeed',
      'onNodeClick',
      'onBackgroundClick',
      'graphData',
      'cameraPosition',
      'dagMode',
      'dagLevelDistance',
      'd3Force',
    ];
    chainableMethods.forEach(method => {
      mockInstance[method] = vi.fn().mockReturnValue(mockInstance);
    });
    mockInstance._destructor = vi.fn();
    mockInstance.graph2ScreenCoords = vi.fn().mockReturnValue({ x: 0, y: 0 });
    return mockInstance;
  };

  const mockFactory = vi.fn().mockImplementation(() => createMockInstance());
  return {
    default: vi.fn().mockImplementation(() => mockFactory),
  };
});

describe('GraphViewportComponent', () => {
  let component: GraphViewportComponent;
  let fixture: ComponentFixture<GraphViewportComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphViewportComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphViewportComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});