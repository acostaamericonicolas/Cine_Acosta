import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../../core/auth.service';
import { CuponesService } from '../../../core/cupones.service';
import { RecompensasService } from '../../../core/recompensas.service';
import { CuponPorEdad, CuponPrimeraCompra } from '../../../models/cupon';
import { Canje } from '../../../models/recompensa';
import { edad, fechaLocal } from '../../../shared/fechas';

@Component({
  imports: [DatePipe, DecimalPipe],
  selector: 'app-perfil',
  styleUrl: './perfil.css',
  templateUrl: './perfil.html',
})
export class Perfil {
  private auth = inject(AuthService);
  private cuponesService = inject(CuponesService);
  private recompensasService = inject(RecompensasService);
  private hoy = fechaLocal();

  perfil = this.auth.perfil;
  cargando = signal(true);
  error = signal('');

  cuponPrimeraCompra = signal<CuponPrimeraCompra | null>(null);
  private cuponesPorEdad = signal<CuponPorEdad[]>([]);
  canjes = signal<Canje[]>([]);

  edad = computed(() => {
    const p = this.perfil();
    return p ? edad(p.fecha_nacimiento, this.hoy) : 0;
  });

  // Cupones por edad que hoy le corresponden al usuario (activos, vigentes y con la edad alcanzada)
  cuponesEdadDisponibles = computed(() =>
    this.cuponesPorEdad().filter(c =>
      c.activo && c.vigente_desde <= this.hoy && this.hoy <= c.vigente_hasta && this.edad() >= c.edad_minima
    )
  );

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      // Crédito y puntos pueden haber cambiado desde el login
      await this.auth.refrescarPerfil();
      const id = this.perfil()?.id;
      if (!id) return;
      const [primeraCompra, porEdad, canjes] = await Promise.all([
        this.cuponesService.obtenerCuponPrimeraCompra(id),
        this.cuponesService.listarPorEdad(),
        this.recompensasService.misCanjes(id),
      ]);
      this.canjes.set(canjes);
      this.cuponPrimeraCompra.set(primeraCompra);
      this.cuponesPorEdad.set(porEdad);
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cargar el perfil');
    } finally {
      this.cargando.set(false);
    }
  }
}
