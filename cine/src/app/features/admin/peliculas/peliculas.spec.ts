import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Peliculas } from './peliculas';

describe('Peliculas', () => {
  let component: Peliculas;
  let fixture: ComponentFixture<Peliculas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Peliculas],
    }).compileComponents();

    fixture = TestBed.createComponent(Peliculas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
