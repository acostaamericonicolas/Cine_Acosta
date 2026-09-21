import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TarjetaPelicula } from './tarjeta-pelicula';

describe('TarjetaPelicula', () => {
  let component: TarjetaPelicula;
  let fixture: ComponentFixture<TarjetaPelicula>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TarjetaPelicula],
    }).compileComponents();

    fixture = TestBed.createComponent(TarjetaPelicula);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
