import { DatePipe, NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { PeliculasService } from '../../../core/peliculas.service';
import { PeliculaConVenta } from '../../../models/pelicula';
import { TarjetaPelicula } from '../../../shared/componentes/tarjeta-pelicula/tarjeta-pelicula';

// Ignora mayúsculas y tildes: "amelie" encuentra "Amélie"
const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

@Component({
  selector: 'app-home',
  imports: [DatePipe, NgClass, TarjetaPelicula],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private service = inject(PeliculasService);

  peliculas = signal<PeliculaConVenta[]>([]);
  busqueda = signal('');
  generosElegidos = signal<string[]>([]);
  cargando = signal(true);
  error = signal('');

  // Las 3 más vendidas (la lista ya llega ordenada por ventas). Sin ventas, no hay ranking.
  top3 = computed(() =>
    this.peliculas().filter(p => p.vendidas > 0).slice(0, 3).map(p => p.id)
  );

  // Solo se ofrecen los géneros que existen en la cartelera actual
  generosDisponibles = computed(() =>
    [...new Set(this.peliculas().flatMap(p => p.generos))].sort((a, b) => a.localeCompare(b, 'es'))
  );

  filtradas = computed(() => {
    const texto = normalizar(this.busqueda().trim());
    const elegidos = this.generosElegidos();
    return this.peliculas().filter(p =>
      normalizar(p.nombre).includes(texto) &&
      elegidos.every(g => p.generos.includes(g))   // cambiá a some() para "cualquiera"
    );
  });

  hayFiltros = computed(() => this.busqueda().trim() !== '' || this.generosElegidos().length > 0);

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      this.peliculas.set(await this.service.listarCartelera());
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cargar la cartelera');
    } finally {
      this.cargando.set(false);
    }
  }

  alternarGenero(genero: string) {
    this.generosElegidos.update(lista =>
      lista.includes(genero) ? lista.filter(g => g !== genero) : [...lista, genero]
    );
  }

  limpiarFiltros() {
    this.busqueda.set('');
    this.generosElegidos.set([]);
  }
}