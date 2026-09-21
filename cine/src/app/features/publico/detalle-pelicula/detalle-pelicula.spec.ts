import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DetallePelicula } from './detalle-pelicula';

describe('DetallePelicula', () => {
  let component: DetallePelicula;
  let fixture: ComponentFixture<DetallePelicula>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DetallePelicula],
    }).compileComponents();

    fixture = TestBed.createComponent(DetallePelicula);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
