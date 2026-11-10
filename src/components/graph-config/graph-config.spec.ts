import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphConfig } from './graph-config';

describe('GraphConfig', () => {
  let component: GraphConfig;
  let fixture: ComponentFixture<GraphConfig>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphConfig],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphConfig);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
