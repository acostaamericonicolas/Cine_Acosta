import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { CuponesService } from '../../../core/cupones.service';
import { RecompensasService } from '../../../core/recompensas.service';
import { ComprasService } from '../../../core/compras.service';
import { ResenasService } from '../../../core/resenas.service';
import { PeliculaVista } from '../../../models/compra';
import { EstrellasPipe } from '../../../shared/pipes/estrellas-pipe';
import { CuponPorEdad, CuponPrimeraCompra } from '../../../models/cupon';
import { Canje } from '../../../models/recompensa';
import { edad, fechaLocal } from '../../../shared/fechas';

@Component({
  imports: [DatePipe, DecimalPipe, RouterLink, EstrellasPipe],
  selector: 'app-perfil',
  styleUrl: './perfil.css',
  templateUrl: './perfil.html',
})
export class Perfil {
  private auth = inject(AuthService);
  private cuponesService = inject(CuponesService);
  private recompensasService = inject(RecompensasService);
  private comprasService = inject(ComprasService);
  private resenasService = inject(ResenasService);
  private hoy = fechaLocal();

  perfil = this.auth.perfil;
  cargando = signal(true);
  error = signal('');

  cuponPrimeraCompra = signal<CuponPrimeraCompra | null>(null);
  private cuponesPorEdad = signal<CuponPorEdad[]>([]);
  canjes = signal<Canje[]>([]);

  // HU-12: películas ya vistas y mi calificación de cada una (película id → estrellas)
  misPeliculas = signal<PeliculaVista[]>([]);
  calificaciones = signal<Map<number, number>>(new Map());

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
      const [primeraCompra, porEdad, canjes, vistas, calificaciones] = await Promise.all([
        this.cuponesService.obtenerCuponPrimeraCompra(id),
        this.cuponesService.listarPorEdad(),
        this.recompensasService.misCanjes(id),
        this.comprasService.misPeliculas(id),
        this.resenasService.misCalificaciones(id),
      ]);
      this.canjes.set(canjes);
      this.misPeliculas.set(vistas);
      this.calificaciones.set(calificaciones);
      this.cuponPrimeraCompra.set(primeraCompra);
      this.cuponesPorEdad.set(porEdad);
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cargar el perfil');
    } finally {
      this.cargando.set(false);
    }
  }
}
