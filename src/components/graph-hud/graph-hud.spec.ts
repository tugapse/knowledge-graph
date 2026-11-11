import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphHudComponent } from './graph-hud';

describe('GraphHudComponent', () => {
  let component: GraphHudComponent;
  let fixture: ComponentFixture<GraphHudComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphHudComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphHudComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
