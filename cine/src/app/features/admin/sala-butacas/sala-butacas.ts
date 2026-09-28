import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Salas as SalasService } from '../../../services/salas';
import { Sala } from '../../../models/sala';
import { MapaButacas } from '../../../shared/componentes/mapa-butacas/mapa-butacas';
import { BUTACAS, Butaca } from '../../../shared/sala-layout';
import { mensajeDeError } from '../../../shared/errores';

@Component({
  selector: 'app-sala-butacas',
  imports: [RouterLink, MapaButacas],
  templateUrl: './sala-butacas.html',
  styleUrl: './sala-butacas.css',
})
export class SalaButacas {
  private route = inject(ActivatedRoute);
  private service = inject(SalasService);

  readonly total = BUTACAS.length;

  sala = signal<Sala | null>(null);
  deshabilitadas = signal<string[]>([]);
  cargando = signal(true);
  noEncontrada = signal(false);
  ocupado = signal(false);   // evita dos cambios a la vez
  error = signal('');

  habilitadas = computed(() => this.total - this.deshabilitadas().length);

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      this.noEncontrada.set(true);
      this.cargando.set(false);
      return;
    }
    this.cargar(id);
  }

  private async cargar(id: number) {
    try {
      const [sala, deshabilitadas] = await Promise.all([
        this.service.obtener(id),
        this.service.deshabilitadas(id),
      ]);
      this.sala.set(sala);
      this.deshabilitadas.set(deshabilitadas);
    } catch {
      this.noEncontrada.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  async alternar(b: Butaca) {
    const sala = this.sala();
    if (!sala || this.ocupado()) return;

    this.ocupado.set(true);
    this.error.set('');
    try {
      if (this.deshabilitadas().includes(b.id)) {
        await this.service.habilitar(sala.id, b.fila, b.numero);
        this.deshabilitadas.update(lista => lista.filter(id => id !== b.id));
      } else {
        await this.service.deshabilitar(sala.id, b.fila, b.numero);
        this.deshabilitadas.update(lista => [...lista, b.id]);
      }
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo cambiar la butaca'));
    } finally {
      this.ocupado.set(false);
    }
  }
}