import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeleccionEntradas } from './seleccion-entradas';

describe('SeleccionEntradas', () => {
  let component: SeleccionEntradas;
  let fixture: ComponentFixture<SeleccionEntradas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeleccionEntradas],
    }).compileComponents();

    fixture = TestBed.createComponent(SeleccionEntradas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
