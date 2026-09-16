import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SeleccionEntradasComponent } from './seleccion-entradas';

describe('SeleccionEntradasComponent', () => {
  let component: SeleccionEntradasComponent;
  let fixture: ComponentFixture<SeleccionEntradasComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeleccionEntradasComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SeleccionEntradasComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});