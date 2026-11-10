import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphInspector } from './graph-inspector';

describe('GraphInspector', () => {
  let component: GraphInspector;
  let fixture: ComponentFixture<GraphInspector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphInspector],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphInspector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
