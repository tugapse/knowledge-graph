import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphHud } from './graph-hud';

describe('GraphHud', () => {
  let component: GraphHud;
  let fixture: ComponentFixture<GraphHud>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GraphHud],
    }).compileComponents();

    fixture = TestBed.createComponent(GraphHud);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
