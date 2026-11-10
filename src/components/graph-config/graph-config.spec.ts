import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphConfigComponent } from './graph-config';

describe('GraphConfigComponent', () => {
  let component: GraphConfigComponent;
  let fixture: ComponentFixture<GraphConfigComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphConfigComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphConfigComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
