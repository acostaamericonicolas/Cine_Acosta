import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SalaButacas } from './sala-butacas';

describe('SalaButacas', () => {
  let component: SalaButacas;
  let fixture: ComponentFixture<SalaButacas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SalaButacas],
    }).compileComponents();

    fixture = TestBed.createComponent(SalaButacas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
