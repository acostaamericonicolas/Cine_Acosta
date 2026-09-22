import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CandyCategorias } from './candy-categorias';

describe('CandyCategorias', () => {
  let component: CandyCategorias;
  let fixture: ComponentFixture<CandyCategorias>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandyCategorias],
    }).compileComponents();

    fixture = TestBed.createComponent(CandyCategorias);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
