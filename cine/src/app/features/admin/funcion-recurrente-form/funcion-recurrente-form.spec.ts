import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FuncionRecurrenteForm } from './funcion-recurrente-form';

describe('FuncionRecurrenteForm', () => {
  let component: FuncionRecurrenteForm;
  let fixture: ComponentFixture<FuncionRecurrenteForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FuncionRecurrenteForm],
    }).compileComponents();

    fixture = TestBed.createComponent(FuncionRecurrenteForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
