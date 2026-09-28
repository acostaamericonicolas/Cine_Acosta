import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Auth as AuthService } from '../../../services/auth';
import { Cupones as CuponesService } from '../../../services/cupones';
import { Recompensas as RecompensasService } from '../../../services/recompensas';
import { Compras as ComprasService } from '../../../services/compras';
import { Resenas as ResenasService } from '../../../services/resenas';
import { PeliculaVista } from '../../../models/compra';
import { EstrellasPipe } from '../../../pipes/estrellas-pipe';
import { CuponPorEdad, CuponPrimeraCompra } from '../../../models/cupon';
import { Canje } from '../../../models/recompensa';
import { edad, fechaLocal } from '../../../shared/fechas';
import { mensajeDeError } from '../../../shared/errores';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { PuntosPipe } from '../../../pipes/puntos-pipe';

@Component({
  imports: [DatePipe, DecimalPipe, RouterLink, EstrellasPipe, PesosPipe, PuntosPipe],
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
  cuponesEdadDisponibles = signal<CuponPorEdad[]>([]);
  canjes = signal<Canje[]>([]);

  // HU-12: películas ya vistas y mi calificación de cada una (película id → estrellas)
  misPeliculas = signal<PeliculaVista[]>([]);
  calificaciones = signal<Map<number, number>>(new Map());

  edad = computed(() => {
    const p = this.perfil();
    return p ? edad(p.fecha_nacimiento, this.hoy) : 0;
  });

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
        this.cuponesService.vigentesParaEdad(this.edad()),
        this.recompensasService.misCanjes(id),
        this.comprasService.misPeliculas(id),
        this.resenasService.misCalificaciones(id),
      ]);
      this.canjes.set(canjes);
      this.misPeliculas.set(vistas);
      this.calificaciones.set(calificaciones);
      this.cuponPrimeraCompra.set(primeraCompra);
      this.cuponesEdadDisponibles.set(porEdad);
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo cargar el perfil'));
    } finally {
      this.cargando.set(false);
    }
  }
}
