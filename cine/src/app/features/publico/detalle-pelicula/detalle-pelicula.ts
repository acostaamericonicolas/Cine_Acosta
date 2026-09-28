import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CatalogoVivo as CatalogoVivoService } from '../../../services/catalogo-vivo';
import { alCambiar } from '../../../shared/al-cambiar';

import { Funciones as FuncionesService } from '../../../services/funciones';
import { Funcion } from '../../../models/funcion';
import { Peliculas as PeliculasService } from '../../../services/peliculas';
import { PeliculaConVenta } from '../../../models/pelicula';
import { Resenas as ResenasService } from '../../../services/resenas';
import { Resena } from '../../../models/resena';
import { DuracionPipe } from '../../../pipes/duracion-pipe';
import { EstrellasPipe } from '../../../pipes/estrellas-pipe';
import { sumarDias } from '../../../shared/fechas';
import { MiResena } from './mi-resena/mi-resena';
import { SoloRolDirective } from '../../../directivas/solo-rol.directive';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { IdiomaPipe } from '../../../pipes/idioma-pipe';

const RESENAS_INICIALES = 5;

@Component({
  selector: 'app-detalle-pelicula',
  imports: [DatePipe, DecimalPipe, RouterLink, DuracionPipe, EstrellasPipe, MiResena, SoloRolDirective, PesosPipe, IdiomaPipe],
  templateUrl: './detalle-pelicula.html',
  styleUrl: './detalle-pelicula.css',
})
export class DetallePelicula {
  private route = inject(ActivatedRoute);
  private peliculasService = inject(PeliculasService);
  private resenasService = inject(ResenasService);
  private funcionesService = inject(FuncionesService);
  private vivo = inject(CatalogoVivoService);



  readonly resenasIniciales = RESENAS_INICIALES;

  pelicula = signal<PeliculaConVenta | null>(null);
  resenas = signal<Resena[]>([]);
  funciones = signal<Funcion[]>([]);
  cargando = signal(true);
  noEncontrada = signal(false);
  errorResenas = signal('');
  errorFunciones = signal('');
  verTodas = signal(false);

  // La preventa abre 7 días antes del estreno (misma regla que venta_abierta en la base)
  aperturaPreventa = computed(() => {
    const p = this.pelicula();
    return p ? sumarDias(p.fecha_estreno, -7) : '';
  });

  promedio = computed(() => {
    const r = this.resenas();
    return r.length ? r.reduce((suma, x) => suma + x.estrellas, 0) / r.length : 0;
  });

  resenasVisibles = computed(() =>
    this.verTodas() ? this.resenas() : this.resenas().slice(0, RESENAS_INICIALES)
  );

  // Agrupa las funciones por día (ya vienen ordenadas por fecha)
  dias = computed(() => {
    const grupos = new Map<string, { fecha: Date; funciones: Funcion[] }>();
    for (const f of this.funciones()) {
      const fecha = new Date(f.inicio);
      const clave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
      if (!grupos.has(clave)) grupos.set(clave, { fecha, funciones: [] });
      grupos.get(clave)!.funciones.push(f);
    }
    return [...grupos.entries()].map(([clave, g]) => ({ clave, ...g }));
  });

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.noEncontrada.set(true);
      this.cargando.set(false);
      return;
    }
    this.cargar(id);

    // Si el admin cambia la película (por ejemplo la pasa a oculta o a próximamente)
    // o sus funciones, el detalle se actualiza solo
    alCambiar(() => this.vivo.peliculas(), () => this.recargarPelicula(id));
    alCambiar(() => this.vivo.funciones(), () => this.recargarFunciones(id));
  }

  private async cargar(id: number) {
    try {
      this.pelicula.set(await this.peliculasService.obtenerConVenta(id));
    } catch {
      // No existe, o está oculta y la policy no deja verla
      this.noEncontrada.set(true);
      this.cargando.set(false);
      return;
    }
    this.cargando.set(false);

    // Reseñas y funciones se piden en paralelo; si una falla, la otra se muestra igual
    const [r, f] = await Promise.allSettled([
      this.resenasService.listarPorPelicula(id),
      this.funcionesService.listarProximas(id),
    ]);
    if (r.status === 'fulfilled') this.resenas.set(r.value);
    else this.errorResenas.set('No se pudieron cargar las reseñas.');
    if (f.status === 'fulfilled') this.funciones.set(f.value);
    else this.errorFunciones.set('No se pudieron cargar las funciones.');
  }

  // Después de publicar, editar o borrar la reseña propia: la lista y el promedio se recalculan
  async recargarResenas() {
    const p = this.pelicula();
    if (!p) return;
    try {
      this.resenas.set(await this.resenasService.listarPorPelicula(p.id));
      this.errorResenas.set('');
    } catch {
      this.errorResenas.set('No se pudieron cargar las reseñas.');
    }
  }

  private async recargarPelicula(id: number) {
    try {
      this.pelicula.set(await this.peliculasService.obtenerConVenta(id));
      this.noEncontrada.set(false);
    } catch {
      this.noEncontrada.set(true);   // pasó a oculta: la policy ya no la devuelve
    }
  }

  private async recargarFunciones(id: number) {
    try {
      this.funciones.set(await this.funcionesService.listarProximas(id));
      this.errorFunciones.set('');
    } catch {
      /* se siguen viendo las anteriores */
    }
  }
}
