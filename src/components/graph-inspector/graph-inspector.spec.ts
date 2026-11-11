import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphInspectorComponent } from './graph-inspector';

describe('GraphInspectorComponent', () => {
  let component: GraphInspectorComponent;
  let fixture: ComponentFixture<GraphInspectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphInspectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphInspectorComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
