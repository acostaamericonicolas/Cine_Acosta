import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActividadService } from '../../../core/actividad.service';
import { Actividad as FilaActividad } from '../../../models/actividad';
import { fechaLocal, sumarDias } from '../../../shared/fechas';

// Ignora mayúsculas y tildes al buscar
const normalizar = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * HU-37: log de actividad. Lo escriben los triggers de la base; acá se consulta
 * por rango de fechas, ordenado de lo más nuevo a lo más viejo, con un buscador.
 */
@Component({
  selector: 'app-actividad',
  imports: [DatePipe],
  templateUrl: './actividad.html',
  styleUrl: './actividad.css',
})
export class Actividad {
  private service = inject(ActividadService);

  desde = signal(sumarDias(fechaLocal(), -7));
  hasta = signal(fechaLocal());
  busqueda = signal('');

  filas = signal<FilaActividad[]>([]);
  cargando = signal(true);
  error = signal('');

  filtradas = computed(() => {
    const texto = normalizar(this.busqueda().trim());
    if (!texto) return this.filas();
    return this.filas().filter(f => normalizar(`${f.usuario} ${f.accion} ${f.detalle}`).includes(texto));
  });

  constructor() {
    this.cargar();
  }

  async cargar() {
    this.error.set('');
    if (this.hasta() < this.desde()) {
      this.error.set('La fecha "hasta" tiene que ser igual o posterior a "desde".');
      return;
    }
    this.cargando.set(true);
    try {
      this.filas.set(await this.service.listar(this.desde(), this.hasta()));
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cargar la actividad');
    } finally {
      this.cargando.set(false);
    }
  }
}
