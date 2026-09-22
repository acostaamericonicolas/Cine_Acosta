import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CandyProductos } from './candy-productos';

describe('CandyProductos', () => {
  let component: CandyProductos;
  let fixture: ComponentFixture<CandyProductos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CandyProductos],
    }).compileComponents();

    fixture = TestBed.createComponent(CandyProductos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
