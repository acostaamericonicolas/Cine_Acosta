import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth.service';
import { ComprasService } from '../../../core/compras.service';
import { CompraResumen } from '../../../models/compra';

const DOS_HORAS = 2 * 60 * 60 * 1000;

type Situacion = 'vigente' | 'pasada' | 'usada' | 'cancelada';

const TEXTO_SITUACION: Record<Situacion, string> = {
  vigente: 'Vigente',
  pasada: 'Función pasada',
  usada: 'Usada',
  cancelada: 'Cancelada',
};

/**
 * HU-28: "Mis compras" con su estado y la opción de cancelar hasta 2 horas antes.
 * La regla la controla cancelar_compra en la base; acá solo se muestra si está disponible.
 */
@Component({
  selector: 'app-mis-compras',
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './mis-compras.html',
  styleUrl: './mis-compras.css',
})
export class MisCompras {
  private auth = inject(AuthService);
  private compras = inject(ComprasService);

  readonly textoSituacion = TEXTO_SITUACION;

  lista = signal<CompraResumen[]>([]);
  cargando = signal(true);
  error = signal('');
  mensaje = signal('');
  cancelando = signal<string | null>(null);

  constructor() {
    this.cargar();
  }

  private async cargar() {
    try {
      const perfil = this.auth.perfil();
      if (perfil) this.lista.set(await this.compras.misCompras(perfil.id));
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudieron cargar tus compras');
    } finally {
      this.cargando.set(false);
    }
  }

  situacion(c: CompraResumen): Situacion {
    if (c.estado !== 'vigente') return c.estado;
    return Date.parse(c.inicio) <= Date.now() ? 'pasada' : 'vigente';
  }

  // Se puede cancelar si está vigente y faltan más de 2 horas para la función
  puedeCancelar(c: CompraResumen): boolean {
    return c.estado === 'vigente' && Date.parse(c.inicio) - Date.now() > DOS_HORAS;
  }

  // Vigente pero ya dentro de las 2 horas previas: se avisa por qué no se puede
  fueraDePlazo(c: CompraResumen): boolean {
    return this.situacion(c) === 'vigente' && !this.puedeCancelar(c);
  }

  creditoACobrar(c: CompraResumen): number {
    return c.total_pagado + c.credito_usado;
  }

  async cancelar(c: CompraResumen) {
    const partes = [`Se te acreditan $ ${this.creditoACobrar(c).toFixed(2)} como crédito (no se devuelve dinero).`];
    if (c.puntos_ganados > 0) partes.push(`Se descuentan los ${c.puntos_ganados} puntos que ganaste.`);
    if (c.puntos_canjeados > 0) partes.push(`Se te devuelven los ${c.puntos_canjeados} puntos que canjeaste.`);
    partes.push('Si usaste un cupón, no se devuelve.');
    if (!confirm(`¿Cancelar la compra ${c.codigo} de "${c.pelicula}"?\n\n${partes.join('\n')}`)) return;

    this.error.set('');
    this.mensaje.set('');
    this.cancelando.set(c.codigo);
    try {
      const r = await this.compras.cancelar(c.codigo);
      this.mensaje.set(`Compra ${r.codigo} cancelada. Se acreditaron $ ${Number(r.credito_acreditado).toFixed(2)} a tu crédito.`);
      await this.auth.refrescarPerfil();   // crédito y puntos nuevos
      await this.cargar();
    } catch (e) {
      this.error.set((e as Error).message);   // mensaje de la base: dice por qué no se pudo
    } finally {
      this.cancelando.set(null);
    }
  }
}
