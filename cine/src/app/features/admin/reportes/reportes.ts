import { DatePipe, NgStyle } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { Reportes as ReportesService } from '../../../services/reportes';
import { Barra, VentaDiaria } from '../../../models/reporte';
import { fechaLocal, sumarDias } from '../../../shared/fechas';
import { mensajeDeError } from '../../../shared/errores';
import { PesosPipe } from '../../../pipes/pesos-pipe';
import { fechaNoAnterior } from '../../../validators/validators';

type Periodo = 'semana' | 'mes';

// Número con coma decimal, como lo espera el Excel en castellano
const numeroCsv = (n: number) => n.toFixed(2).replace('.', ',');

/**
 * HU-35: facturación diaria y entradas vendidas, exportable a Excel (CSV) y PDF (impresión).
 * HU-36: películas más vistas por semana o mes y producto del candy más vendido,
 *        con barras hechas con CSS y ngStyle (sin librerías de gráficos).
 */
@Component({
  selector: 'app-reportes',
  imports: [DatePipe, NgStyle, PesosPipe, FormField],
  templateUrl: './reportes.html',
  styleUrl: './reportes.css',
})
export class Reportes {
  private service = inject(ReportesService);

  // ----- HU-35 -----
  // Rango del reporte con Signal Forms (el máximo de un año lo controla la base)
  filtroVentas = signal({ desde: sumarDias(fechaLocal(), -6), hasta: fechaLocal() });
  fVentas = form(this.filtroVentas, (s) => {
    required(s.desde, { message: 'Elegí la fecha desde' });
    required(s.hasta, { message: 'Elegí la fecha hasta' });
    fechaNoAnterior(s.hasta, s.desde, 'No puede ser anterior a "desde"');
  });
  ventas = signal<VentaDiaria[]>([]);
  cargandoVentas = signal(true);
  errorVentas = signal('');

  totales = computed(() => this.ventas().reduce((t, v) => ({
    compras: t.compras + v.compras,
    entradas: t.entradas + v.entradas,
    unidades_candy: t.unidades_candy + v.unidades_candy,
    facturado: t.facturado + v.facturado,
    credito_usado: t.credito_usado + v.credito_usado,
  }), { compras: 0, entradas: 0, unidades_candy: 0, facturado: 0, credito_usado: 0 }));

  // ----- HU-36 -----
  periodo = signal<Periodo>('semana');
  desplazamiento = signal(0);   // 0 = actual, -1 = anterior...
  peliculas = signal<Barra[]>([]);
  candy = signal<Barra[]>([]);
  cargandoGraficos = signal(true);
  errorGraficos = signal('');

  // Semana de lunes a domingo, o mes calendario
  rango = computed(() => {
    const hoy = new Date();
    if (this.periodo() === 'semana') {
      const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7) + 7 * this.desplazamiento());
      return { desde: fechaLocal(lunes), hasta: sumarDias(fechaLocal(lunes), 6) };
    }
    const primero = new Date(hoy.getFullYear(), hoy.getMonth() + this.desplazamiento(), 1);
    const ultimo = new Date(primero.getFullYear(), primero.getMonth() + 1, 0);
    return { desde: fechaLocal(primero), hasta: fechaLocal(ultimo) };
  });

  maxPeliculas = computed(() => Math.max(1, ...this.peliculas().map(b => b.valor)));
  maxCandy = computed(() => Math.max(1, ...this.candy().map(b => b.valor)));

  constructor() {
    this.cargarVentas();
    this.cargarGraficos();
  }

  verVentas(event: Event) {
    event.preventDefault();
    this.cargarVentas();
  }

  private async cargarVentas() {
    this.errorVentas.set('');
    if (this.fVentas().invalid()) return;
    this.cargandoVentas.set(true);
    try {
      const { desde, hasta } = this.filtroVentas();
      this.ventas.set(await this.service.ventas(desde, hasta));
    } catch (e) {
      this.errorVentas.set(mensajeDeError(e));   // por ejemplo: rango invertido o mayor a un año
      this.ventas.set([]);
    } finally {
      this.cargandoVentas.set(false);
    }
  }

  cambiarPeriodo(p: Periodo) {
    this.periodo.set(p);
    this.desplazamiento.set(0);
    this.cargarGraficos();
  }

  mover(delta: number) {
    this.desplazamiento.update(d => Math.min(0, d + delta));   // no se ve el futuro
    this.cargarGraficos();
  }

  private async cargarGraficos() {
    const { desde, hasta } = this.rango();
    this.errorGraficos.set('');
    this.cargandoGraficos.set(true);
    try {
      const [peliculas, candy] = await Promise.all([
        this.service.peliculasMasVistas(desde, hasta),
        this.service.candyMasVendido(desde, hasta),
      ]);
      this.peliculas.set(peliculas);
      this.candy.set(candy);
    } catch (e) {
      this.errorGraficos.set(mensajeDeError(e));
    } finally {
      this.cargandoGraficos.set(false);
    }
  }

  // Ancho de la barra en % del máximo (ngStyle)
  ancho(valor: number, max: number) {
    return { width: `${Math.max(2, (valor / max) * 100)}%` };
  }

  // ----- Exportar -----
  exportarCsv() {
    const t = this.totales();
    const filas = [
      ['Fecha', 'Compras', 'Entradas vendidas', 'Unidades de candy', 'Facturado ($)', 'Crédito usado ($)'],
      ...this.ventas().map(v => [
        v.fecha.split('-').reverse().join('/'), v.compras, v.entradas, v.unidades_candy,
        numeroCsv(v.facturado), numeroCsv(v.credito_usado),
      ]),
      ['Total', t.compras, t.entradas, t.unidades_candy, numeroCsv(t.facturado), numeroCsv(t.credito_usado)],
    ];
    // ";" y BOM: así Excel en castellano lo abre directo, con columnas y tildes bien
    const csv = '﻿' + filas.map(f => f.join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturacion_${this.filtroVentas().desde}_a_${this.filtroVentas().hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  imprimir() {
    window.print();
  }
}
