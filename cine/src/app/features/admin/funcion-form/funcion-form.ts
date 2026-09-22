import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { FuncionesService } from '../../../core/funciones.service';
import { Pelicula, PeliculasService } from '../../../core/peliculas.service';

interface FuncionModelo {
  peliculaId: string;   // los <select> trabajan con texto
  fecha: string;
  hora: string;
  formato: string;
  idioma: string;
}

@Component({
  selector: 'app-funcion-form',
  imports: [FormField, RouterLink],
  templateUrl: './funcion-form.html',
  styleUrl: './funcion-form.css',
})
export class FuncionForm {
  private peliculasService = inject(PeliculasService);
  private funcionesService = inject(FuncionesService);
  private router = inject(Router);

  readonly formatos = ['2D', '3D', '4D', '5D'];
  readonly idiomas = [
    { valor: 'castellano', texto: 'Castellano' },
    { valor: 'subtitulada', texto: 'Subtitulada' },
  ];
  readonly hoy = new Date().toISOString().slice(0, 10);

  peliculas = signal<Pelicula[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  error = signal('');
  exito = signal('');

  modelo = signal<FuncionModelo>({
    peliculaId: '', fecha: '', hora: '', formato: '2D', idioma: 'castellano',
  });

  f = form(this.modelo, (s) => {
    required(s.peliculaId, { message: 'Elegí una película' });
    required(s.fecha, { message: 'Elegí una fecha' });
    required(s.hora, { message: 'Elegí una hora' });
  });

  peliculaElegida = computed(() =>
    this.peliculas().find(p => p.id === Number(this.modelo().peliculaId)) ?? null
  );

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      const todas = await this.peliculasService.listar();
      // Solo tiene sentido programar funciones de películas en cartelera o próximas
      this.peliculas.set(todas.filter(p => p.estado !== 'oculta'));
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudieron cargar las películas'));
    } finally {
      this.cargando.set(false);
    }
  }

  async guardar(event: Event) {
    event.preventDefault();
    if (this.f().invalid()) return;

    this.error.set('');
    this.exito.set('');
    this.guardando.set(true);
    try {
      const m = this.modelo();
      // El navegador arma la fecha en horario local y toISOString la pasa a UTC
      const inicio = new Date(`${m.fecha}T${m.hora}`).toISOString();

      const funcion = await this.funcionesService.crearConAsignacionAutomatica({
        pelicula_id: Number(m.peliculaId),
        inicio,
        formato: m.formato as any,
        idioma: m.idioma as any,
      });

      this.exito.set(`Función creada. Se asignó la sala #${funcion.sala_id}.`);
      // Se limpian solo la fecha y la hora, para cargar varias funciones seguidas de la misma película
      this.modelo.update(v => ({ ...v, fecha: '', hora: '' }));
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudo crear la función'));
    } finally {
      this.guardando.set(false);
    }
  }

  private texto(e: unknown, defecto: string): string {
    return (e as { message?: string }).message ?? defecto;
  }
}