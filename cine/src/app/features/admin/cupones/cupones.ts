import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, min, max, validate } from '@angular/forms/signals';
import { CuponesService, CuponPorEdad } from '../../../core/cupones.service';

type EstadoVigencia = 'Vigente' | 'Programado' | 'Vencido' | 'Desactivado';

@Component({
  selector: 'app-cupones',
  imports: [FormField, DatePipe],
  templateUrl: './cupones.html',
  styleUrl: './cupones.css',
})
export class Cupones {
  private service = inject(CuponesService);
  private hoy = new Date().toISOString().slice(0, 10);

  cargando = signal(true);
  error = signal('');
  mensaje = signal('');

  // --- Primera compra ---
  primeraCompra = signal({ porcentaje: 0 });
  fPrimeraCompra = form(this.primeraCompra, (s) => {
    min(s.porcentaje, 1, { message: 'Tiene que ser mayor a 0' });
    max(s.porcentaje, 100, { message: 'No puede superar el 100%' });
  });
  guardandoPrimeraCompra = signal(false);

  // --- Por edad ---
  cupones = signal<CuponPorEdad[]>([]);

  nuevoCupon = signal({ edadMinima: 50, porcentaje: 0, desde: '', hasta: '' });
  fNuevoCupon = form(this.nuevoCupon, (s) => {
    required(s.desde, { message: 'Elegí la fecha de inicio' });
    required(s.hasta, { message: 'Elegí la fecha de fin' });
    validate(s.hasta, ({ value, valueOf }) =>
      value() < valueOf(s.desde) ? { kind: 'rango-invalido', message: 'Tiene que ser posterior al inicio' } : null
    );
    min(s.edadMinima, 0, { message: 'No puede ser negativa' });
    max(s.edadMinima, 120, { message: 'Ingresá una edad razonable' });
    min(s.porcentaje, 1, { message: 'Tiene que ser mayor a 0' });
    max(s.porcentaje, 100, { message: 'No puede superar el 100%' });
  });
  guardandoCupon = signal(false);

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      const [porcentaje, cupones] = await Promise.all([
        this.service.obtenerPorcentajePrimeraCompra(),
        this.service.listarPorEdad(),
      ]);
      this.primeraCompra.set({ porcentaje });
      this.cupones.set(cupones);
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudieron cargar los cupones'));
    } finally {
      this.cargando.set(false);
    }
  }

  estadoVigencia(c: CuponPorEdad): EstadoVigencia {
    if (!c.activo) return 'Desactivado';
    if (this.hoy < c.vigente_desde) return 'Programado';
    if (this.hoy > c.vigente_hasta) return 'Vencido';
    return 'Vigente';
  }

  async guardarPrimeraCompra(event: Event) {
    event.preventDefault();
    if (this.fPrimeraCompra().invalid()) return;
    this.limpiar();
    this.guardandoPrimeraCompra.set(true);
    try {
      await this.service.actualizarPorcentajePrimeraCompra(this.primeraCompra().porcentaje);
      this.mensaje.set('Porcentaje de primera compra actualizado. Se aplica a los próximos registros.');
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudo guardar'));
    } finally {
      this.guardandoPrimeraCompra.set(false);
    }
  }

  async agregarCupon(event: Event) {
    event.preventDefault();
    if (this.fNuevoCupon().invalid()) return;
    this.limpiar();
    this.guardandoCupon.set(true);
    try {
      const c = this.nuevoCupon();
      await this.service.crearPorEdad({
        edad_minima: c.edadMinima,
        porcentaje: c.porcentaje,
        activo: true,
        vigente_desde: c.desde,
        vigente_hasta: c.hasta,
      });
      this.nuevoCupon.set({ edadMinima: 50, porcentaje: 0, desde: '', hasta: '' });
      this.cupones.set(await this.service.listarPorEdad());
      this.mensaje.set('Cupón creado.');
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudo crear el cupón'));
    } finally {
      this.guardandoCupon.set(false);
    }
  }

  async alternarActivo(c: CuponPorEdad) {
    this.limpiar();
    try {
      await this.service.actualizarActivoPorEdad(c.id, !c.activo);
      this.cupones.update(lista => lista.map(x => (x.id === c.id ? { ...x, activo: !c.activo } : x)));
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudo cambiar el estado'));
    }
  }

  async eliminar(c: CuponPorEdad) {
    if (!confirm('¿Eliminar este cupón?')) return;
    this.limpiar();
    try {
      await this.service.eliminarPorEdad(c.id);
      this.cupones.update(lista => lista.filter(x => x.id !== c.id));
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudo eliminar'));
    }
  }
  
  private limpiar() { this.error.set(''); this.mensaje.set(''); }
  private texto(e: unknown, defecto: string): string {
    return (e as { message?: string }).message ?? defecto;
  }
}