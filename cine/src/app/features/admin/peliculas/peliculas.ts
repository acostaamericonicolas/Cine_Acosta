import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Peliculas as PeliculasService } from '../../../services/peliculas';
import { ESTADOS, EstadoPelicula, Pelicula } from '../../../models/pelicula';
import { Imagenes as ImagenesService } from '../../../services/imagenes';
import { mensajeDeError } from '../../../shared/errores';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { RestriccionPipe } from '../../../pipes/restriccion-pipe';
import { ListaGeneros } from '../../../shared/componentes/lista-generos/lista-generos';

@Component({
  selector: 'app-peliculas',
  imports: [RouterLink, DatePipe, PesosPipe, RestriccionPipe, ListaGeneros],
  templateUrl: './peliculas.html',
  styleUrl: './peliculas.css',
})
export class Peliculas {
  private service = inject(PeliculasService);
  private imagenes = inject(ImagenesService);
  
  readonly estados = ESTADOS;
  peliculas = signal<Pelicula[]>([]);
  cargando = signal(true);
  error = signal('');

  constructor() {
    this.cargar();
  }

  async cargar() {
    try {
      this.peliculas.set(await this.service.listar());
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudieron cargar las películas'));
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarEstado(p: Pelicula, sel: HTMLSelectElement) {
    const estado = sel.value as EstadoPelicula;
    this.error.set('');
    try {
      await this.service.actualizar(p.id, { estado });
      this.peliculas.update(lista => lista.map(x => (x.id === p.id ? { ...x, estado } : x)));
    } catch (e) {
      sel.value = p.estado;   // volvemos al valor anterior
      this.error.set(mensajeDeError(e, 'No se pudo cambiar el estado'));
    }
  }

  async eliminar(p: Pelicula) {
    if (!confirm(`¿Eliminar "${p.nombre}"? Esta acción no se puede deshacer.`)) return;
    this.error.set('');
    try {
      await this.service.eliminar(p.id);
      if (p.imagen_path) await this.imagenes.eliminar('posters', p.imagen_path).catch(() => { });
      this.peliculas.update(lista => lista.filter(x => x.id !== p.id));
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo eliminar'));
    }
  }
}