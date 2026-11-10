import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphViewport } from './graph-viewport';

describe('GraphViewport', () => {
  let component: GraphViewport;
  let fixture: ComponentFixture<GraphViewport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphViewport],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphViewport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
