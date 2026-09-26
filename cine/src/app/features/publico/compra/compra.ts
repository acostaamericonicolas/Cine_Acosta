import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { FuncionesService } from '../../../core/funciones.service';
import { PeliculasService } from '../../../core/peliculas.service';
import { ReservasService } from '../../../core/reservas.service';
import { SalasService } from '../../../core/salas.service';
import { ButacaOcupada } from '../../../models/butaca-ocupada';
import { Funcion } from '../../../models/funcion';
import { PeliculaConVenta } from '../../../models/pelicula';
import { Precios } from '../../../models/sala';
import { MapaButacas } from '../../../shared/componentes/mapa-butacas/mapa-butacas';
import { precioEntrada } from '../../../shared/precios';
import { BUTACAS, Butaca, TEXTO_TIPO } from '../../../shared/sala-layout';

const idDe = (fila: string, numero: number) => `${fila}-${numero}`;

@Component({
  selector: 'app-compra',
  imports: [DatePipe, DecimalPipe, RouterLink, MapaButacas],
  templateUrl: './compra.html',
  styleUrl: './compra.css',
})
export class Compra {
  private route = inject(ActivatedRoute);
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);
  private salasService = inject(SalasService);
  private reservas = inject(ReservasService);

  readonly textoTipo = TEXTO_TIPO;

  funcion = signal<Funcion | null>(null);
  pelicula = signal<PeliculaConVenta | null>(null);
  precios = signal<Precios>({ general: 0, accesible: 0, vip: 0 });
  deshabilitadas = signal<string[]>([]);

  // Butacas tomadas en la función, por id 'J-10'. Se actualiza con Realtime.
  private ocupadas = signal<Map<string, ButacaOcupada>>(new Map());
  private miHash = signal('');
  private ahora = signal(Date.now());

  cargando = signal(true);
  error = signal('');         // error al cargar la pantalla
  aviso = signal('');         // error al tocar una butaca (el mensaje viene de la base)
  procesando = signal<string | null>(null);

  // Las reservas vencidas se ignoran aunque la fila siga en la base
  private vigentes = computed(() =>
    [...this.ocupadas().values()].filter(o =>
      o.estado === 'vendida' || (o.vence !== null && Date.parse(o.vence) > this.ahora())
    )
  );

  private misIds = computed(() =>
    new Set(this.vigentes().filter(o => o.token_hash === this.miHash()).map(o => idDe(o.fila, o.numero)))
  );

  ocupadasPorOtros = computed(() =>
    this.vigentes().map(o => idDe(o.fila, o.numero)).filter(id => !this.misIds().has(id))
  );

  seleccionadas = computed(() => BUTACAS.filter(b => this.misIds().has(b.id)));
  idsSeleccionadas = computed(() => this.seleccionadas().map(b => b.id));

  lineas = computed(() => {
    const p = this.pelicula();
    if (!p) return [];
    return this.seleccionadas().map(b => ({ butaca: b, precio: precioEntrada(b.tipo, this.precios(), p) }));
  });

  total = computed(() => this.lineas().reduce((suma, l) => suma + l.precio, 0));
  hayVip = computed(() => this.seleccionadas().some(b => b.tipo === 'vip'));

  // Todas mis reservas vencen juntas (la base les pone el mismo vencimiento)
  tiempoRestante = computed(() => {
    const mias = this.vigentes().filter(o => o.token_hash === this.miHash() && o.vence);
    if (mias.length === 0) return null;
    const vence = Math.min(...mias.map(o => Date.parse(o.vence!)));
    const s = Math.max(0, Math.floor((vence - this.ahora()) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  private canal: RealtimeChannel | null = null;
  private funcionId = Number(this.route.snapshot.paramMap.get('funcionId'));

  constructor() {
    const reloj = setInterval(() => this.ahora.set(Date.now()), 1000);

    inject(DestroyRef).onDestroy(() => {
      clearInterval(reloj);
      if (this.canal) this.reservas.dejarDeEscuchar(this.canal);
      // Si se va sin comprar, las butacas quedan libres para otros (si falla, vencen solas)
      if (this.idsSeleccionadas().length > 0) this.reservas.liberarTodas(this.funcionId).catch(() => { });
    });

    this.cargar();
  }

  private async cargar() {
    try {
      if (!Number.isInteger(this.funcionId) || this.funcionId <= 0) throw new Error('La función no existe.');

      const funcion = await this.funcionesService.obtener(this.funcionId);
      const [pelicula, precios, deshabilitadas, miHash] = await Promise.all([
        this.peliculasService.obtenerConVenta(funcion.pelicula_id),
        this.salasService.precios(),
        this.salasService.deshabilitadas(funcion.sala_id),
        this.reservas.hashToken(),
      ]);
      if (!pelicula.venta_abierta) {
        throw new Error(`La venta de entradas para "${pelicula.nombre}" todavía no está abierta.`);
      }
      if (Date.parse(funcion.inicio) <= Date.now()) throw new Error('Esta función ya empezó.');

      this.funcion.set(funcion);
      this.pelicula.set(pelicula);
      this.precios.set(precios);
      this.deshabilitadas.set(deshabilitadas);
      this.miHash.set(miHash);

      // Primero se escucha y después se lee, para no perder cambios en el medio
      this.canal = this.reservas.escuchar(
        this.funcionId,
        (o) => this.ocupadas.update(m => new Map(m).set(idDe(o.fila, o.numero), o)),
        (fila, numero) => this.quitar(idDe(fila, numero)),
      );
      const lista = await this.reservas.listar(this.funcionId);
      this.ocupadas.set(new Map(lista.map(o => [idDe(o.fila, o.numero), o])));
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cargar la función');
    } finally {
      this.cargando.set(false);
    }
  }

  private quitar(id: string) {
    this.ocupadas.update(m => {
      const nuevo = new Map(m);
      nuevo.delete(id);
      return nuevo;
    });
  }

  async tocar(b: Butaca) {
    if (this.procesando() || this.deshabilitadas().includes(b.id)) return;
    this.aviso.set('');

    if (this.ocupadasPorOtros().includes(b.id)) {
      this.aviso.set(`La butaca ${b.id} está ocupada. Elegí otra.`);
      return;
    }

    this.procesando.set(b.id);
    try {
      if (this.misIds().has(b.id)) {
        await this.reservas.liberar(this.funcionId, b.fila, b.numero);
        this.quitar(b.id);
      } else {
        const vence = await this.reservas.reservar(this.funcionId, b.fila, b.numero);
        // Se agrega ya, sin esperar el aviso de Realtime
        this.ocupadas.update(m => new Map(m).set(b.id, {
          funcion_id: this.funcionId, fila: b.fila, numero: b.numero,
          estado: 'reservada', vence, token_hash: this.miHash(),
        }));
      }
    } catch (e) {
      this.aviso.set((e as { message?: string }).message ?? `No se pudo reservar la butaca ${b.id}.`);
    } finally {
      this.procesando.set(null);
    }
  }
}
