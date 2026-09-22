import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComboForm } from './combo-form';

describe('ComboForm', () => {
  let component: ComboForm;
  let fixture: ComponentFixture<ComboForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComboForm],
    }).compileComponents();

    fixture = TestBed.createComponent(ComboForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
