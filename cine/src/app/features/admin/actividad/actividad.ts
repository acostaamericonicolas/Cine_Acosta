import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { Actividad as ActividadService } from '../../../services/actividad';
import { Actividad as FilaActividad } from '../../../models/actividad';
import { fechaLocal, sumarDias } from '../../../shared/fechas';
import { mensajeDeError } from '../../../shared/errores';
import { fechaNoAnterior } from '../../../validators/validators';

// Ignora mayúsculas y tildes al buscar
const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * HU-37: log de actividad. Lo escriben los triggers de la base; acá se consulta
 * por rango de fechas, ordenado de lo más nuevo a lo más viejo, con un buscador.
 */
@Component({
  selector: 'app-actividad',
  imports: [DatePipe, FormField],
  templateUrl: './actividad.html',
  styleUrl: './actividad.css',
})
export class Actividad {
  private service = inject(ActividadService);

  // Filtros con Signal Forms, igual que el resto de los formularios
  filtros = signal({ desde: sumarDias(fechaLocal(), -7), hasta: fechaLocal(), busqueda: '' });
  f = form(this.filtros, (s) => {
    required(s.desde, { message: 'Elegí la fecha desde' });
    required(s.hasta, { message: 'Elegí la fecha hasta' });
    fechaNoAnterior(s.hasta, s.desde, 'No puede ser anterior a "desde"');
  });

  filas = signal<FilaActividad[]>([]);
  cargando = signal(true);
  error = signal('');

  filtradas = computed(() => {
    const texto = normalizar(this.filtros().busqueda.trim());
    if (!texto) return this.filas();
    return this.filas().filter(f => normalizar(`${f.usuario} ${f.accion} ${f.detalle}`).includes(texto));
  });

  constructor() {
    this.cargar();
  }

  ver(event: Event) {
    event.preventDefault();
    this.cargar();
  }

  private async cargar() {
    this.error.set('');
    if (this.f().invalid()) return;
    this.cargando.set(true);
    try {
      const { desde, hasta } = this.filtros();
      this.filas.set(await this.service.listar(desde, hasta));
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo cargar la actividad'));
    } finally {
      this.cargando.set(false);
    }
  }
}
