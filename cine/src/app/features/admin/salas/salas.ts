import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { form, FormField, required, min, maxLength } from '@angular/forms/signals';
import { Sala, SalasService } from '../../../core/salas.service';
import { TEXTO_TIPO, TipoButaca } from '../../../shared/sala-layout';

@Component({
  selector: 'app-salas',
  imports: [FormField, RouterLink],
  templateUrl: './salas.html',
  styleUrl: './salas.css',
})
export class Salas {
  private service = inject(SalasService);

  readonly tipos: TipoButaca[] = ['general', 'accesible', 'vip'];
  readonly textoTipo = TEXTO_TIPO;

  salas = signal<Sala[]>([]);
  cargando = signal(true);
  guardandoPrecios = signal(false);
  error = signal('');
  mensaje = signal('');

  // Alta de sala
  nuevaSala = signal({ nombre: '' });
  fSala = form(this.nuevaSala, (s) => {
    required(s.nombre, { message: 'Ingresá el nombre de la sala' });
    maxLength(s.nombre, 50, { message: 'Máximo 50 caracteres' });
  });

  // Precios por tipo
  precios = signal({ general: 0, accesible: 0, vip: 0 });
  fPrecios = form(this.precios, (s) => {
    min(s.general, 1, { message: 'Ingresá un precio mayor a 0' });
    min(s.accesible, 1, { message: 'Ingresá un precio mayor a 0' });
    min(s.vip, 1, { message: 'Ingresá un precio mayor a 0' });
  });

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      const [salas, precios] = await Promise.all([this.service.listar(), this.service.precios()]);
      this.salas.set(salas);
      this.precios.set(precios);
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudieron cargar los datos'));
    } finally {
      this.cargando.set(false);
    }
  }

  async agregar(event: Event) {
    event.preventDefault();
    if (this.fSala().invalid()) return;
    this.limpiar();
    try {
      await this.service.crear(this.nuevaSala().nombre.trim());
      this.nuevaSala.set({ nombre: '' });
      this.salas.set(await this.service.listar());
      this.mensaje.set('Sala creada.');
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudo crear la sala'));
    }
  }

  // Las salas no se eliminan: se desactivan (las funciones ya programadas siguen existiendo)
  async alternarActiva(s: Sala) {
    this.limpiar();
    try {
      await this.service.cambiarActiva(s.id, !s.activa);
      this.salas.update(lista => lista.map(x => (x.id === s.id ? { ...x, activa: !s.activa } : x)));
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudo cambiar el estado de la sala'));
    }
  }

  async guardarPrecios(event: Event) {
    event.preventDefault();
    if (this.fPrecios().invalid()) return;
    this.limpiar();

    const p = this.precios();
    if (p.vip <= p.general) {
      this.error.set('El precio VIP tiene que ser mayor al de una butaca general.');
      return;
    }

    this.guardandoPrecios.set(true);
    try {
      await this.service.guardarPrecios(p);
      this.mensaje.set('Precios guardados.');
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudieron guardar los precios'));
    } finally {
      this.guardandoPrecios.set(false);
    }
  }

  private limpiar() {
    this.error.set('');
    this.mensaje.set('');
  }

  private texto(e: unknown, defecto: string): string {
    return (e as { message?: string }).message ?? defecto;
  }
}