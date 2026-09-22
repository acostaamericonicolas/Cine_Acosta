import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FuncionForm } from './funcion-form';

describe('FuncionForm', () => {
  let component: FuncionForm;
  let fixture: ComponentFixture<FuncionForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FuncionForm],
    }).compileComponents();

    fixture = TestBed.createComponent(FuncionForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
