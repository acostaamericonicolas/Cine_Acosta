import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Funcion, FuncionesService } from '../../../core/funciones.service';
import { Pelicula, PeliculasService } from '../../../core/peliculas.service';
import { Sala, SalasService } from '../../../core/salas.service';

@Component({
  selector: 'app-funciones',
  imports: [RouterLink, DatePipe],
  templateUrl: './funciones.html',
  styleUrl: './funciones.css',
})
export class Funciones {
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);
  private salasService = inject(SalasService);

  funciones = signal<Funcion[]>([]);
  peliculas = signal<Pelicula[]>([]);
  salas = signal<Sala[]>([]);
  cargando = signal(true);
  error = signal('');

  filas = computed(() => {
    const peliculas = new Map(this.peliculas().map(p => [p.id, p.nombre]));
    const salas = new Map(this.salas().map(s => [s.id, s.nombre]));
    return this.funciones().map(f => ({
      ...f,
      pelicula: peliculas.get(f.pelicula_id) ?? '(película eliminada)',
      sala: salas.get(f.sala_id) ?? '(sala eliminada)',
    }));
  });

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      // Próximos 30 días, para no traer un historial enorme
      const desde = new Date().toISOString();
      const hasta = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const [funciones, peliculas, salas] = await Promise.all([
        this.funcionesService.listarPorRango(desde, hasta),
        this.peliculasService.listar(),
        this.salasService.listar(),
      ]);
      this.funciones.set(funciones);
      this.peliculas.set(peliculas);
      this.salas.set(salas);
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudieron cargar las funciones');
    } finally {
      this.cargando.set(false);
    }
  }

  async eliminar(f: Funcion) {
    if (!confirm('¿Eliminar esta función?')) return;
    this.error.set('');
    try {
      await this.funcionesService.eliminar(f.id);
      this.funciones.update(lista => lista.filter(x => x.id !== f.id));
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo eliminar');
    }
  }
}