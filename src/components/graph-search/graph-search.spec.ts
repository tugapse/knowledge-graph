import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphSearch } from './graph-search';

describe('GraphSearch', () => {
  let component: GraphSearch;
  let fixture: ComponentFixture<GraphSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphSearch],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
