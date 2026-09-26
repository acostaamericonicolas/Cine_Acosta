import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { ConCambios } from '../../../core/guards/form-guard';
import { FuncionesService } from '../../../core/funciones.service';
import { Formato, FORMATOS, Idioma, IDIOMAS } from '../../../models/funcion';
import { PeliculasService } from '../../../core/peliculas.service';
import { Pelicula } from '../../../models/pelicula';
import { DIAS_SEMANA, generarFechas } from '../../../shared/fechas-recurrentes';
import { fechaLocal } from '../../../shared/fechas';
import { DatePipe } from '@angular/common';

interface FuncionRecurrenteModelo {
  peliculaId: string;
  dias: number[];
  hora: string;
  desde: string;
  hasta: string;
  formato: Formato;
  idioma: Idioma;
}

interface Resultado {
  fecha: string;      // ISO, para mostrar formateada en el template
  ok: boolean;
  detalle: string;    // "Sala #2" o el motivo del error
}

@Component({
  selector: 'app-funcion-recurrente-form',
  imports: [FormField, RouterLink, DatePipe],
  templateUrl: './funcion-recurrente-form.html',
  styleUrl: './funcion-recurrente-form.css',
})
export class FuncionRecurrenteForm implements ConCambios {
  private peliculasService = inject(PeliculasService);
  private funcionesService = inject(FuncionesService);

  readonly dias = DIAS_SEMANA;
  readonly formatos = FORMATOS;
  readonly idiomas = IDIOMAS;
  readonly hoy = fechaLocal();

  peliculas = signal<Pelicula[]>([]);
  cargando = signal(true);
  error = signal('');

  modelo = signal<FuncionRecurrenteModelo>({
    peliculaId: '', dias: [], hora: '', desde: '', hasta: '', formato: '2D', idioma: 'castellano',
  });

  private inicial = JSON.stringify(this.modelo());

  f = form(this.modelo, (s) => {
    required(s.peliculaId, { message: 'Elegí una película' });
    validate(s.dias, ({ value }) =>
      value().length === 0 ? { kind: 'sin-dias', message: 'Elegí al menos un día' } : null
    );
    required(s.hora, { message: 'Elegí una hora' });
    required(s.desde, { message: 'Elegí la fecha de inicio' });
    required(s.hasta, { message: 'Elegí la fecha de fin' });
    validate(s.hasta, ({ value, valueOf }) =>
      value() < valueOf(s.desde) ? { kind: 'rango-invalido', message: 'Tiene que ser posterior a la fecha de inicio' } : null
    );
  });

  // Vista previa de fechas, antes de crear nada
  fechasPrevistas = computed(() => {
    const m = this.modelo();
    if (!m.dias.length || !m.hora || !m.desde || !m.hasta || m.hasta < m.desde) return [];
    return generarFechas(m.desde, m.hasta, m.dias, m.hora);
  });

  creando = signal(false);
  resultados = signal<Resultado[] | null>(null);
  creadas = computed(() => this.resultados()?.filter(r => r.ok).length ?? 0);
  fallidas = computed(() => this.resultados()?.filter(r => !r.ok).length ?? 0);

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      const todas = await this.peliculasService.listar();
      this.peliculas.set(todas.filter(p => p.estado !== 'oculta'));
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudieron cargar las películas'));
    } finally {
      this.cargando.set(false);
    }
  }

  // Lo consulta formGuard: hay cambios si se tocó el formulario y todavía no se crearon las funciones
  hayCambios(): boolean {
    return this.resultados() === null && JSON.stringify(this.modelo()) !== this.inicial;
  }

  alternarDia(dia: number, marcado: boolean) {
    this.modelo.update(m => ({
      ...m,
      dias: marcado ? [...m.dias, dia] : m.dias.filter(d => d !== dia),
    }));
  }

  async crear(event: Event) {
    event.preventDefault();
    if (this.f().invalid()) return;

    const fechas = this.fechasPrevistas();
    if (fechas.length === 0) return;

    this.error.set('');
    this.resultados.set(null);
    this.creando.set(true);

    const m = this.modelo();
    const resultados: Resultado[] = [];

    // Una por una, en orden: si una falla, se sigue con las demás
    for (const fecha of fechas) {
      try {
        const funcion = await this.funcionesService.crearConAsignacionAutomatica({
          pelicula_id: Number(m.peliculaId),
          inicio: fecha,
          formato: m.formato,
          idioma: m.idioma,
        });
        resultados.push({ fecha, ok: true, detalle: `Sala #${funcion.sala_id}` });
      } catch (e) {
        resultados.push({ fecha, ok: false, detalle: this.texto(e, 'No se pudo crear') });
      }
    }

    this.resultados.set(resultados);
    this.creando.set(false);
  }

  private texto(e: unknown, defecto: string): string {
    return (e as { message?: string }).message ?? defecto;
  }
}