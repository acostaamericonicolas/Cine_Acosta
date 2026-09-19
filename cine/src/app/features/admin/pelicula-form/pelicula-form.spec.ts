import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PeliculaForm } from './pelicula-form';

describe('PeliculaForm', () => {
  let component: PeliculaForm;
  let fixture: ComponentFixture<PeliculaForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PeliculaForm],
    }).compileComponents();

    fixture = TestBed.createComponent(PeliculaForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
