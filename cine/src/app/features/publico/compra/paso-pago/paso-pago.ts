import { DecimalPipe } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { form, FormField, email, validate } from '@angular/forms/signals';
import { Cupon, DatosPago, ErrorCompra, ItemCarrito, LineaEntrada, PasoError } from '../../../../models/compra';
import { ItemCanjeable } from '../../../../models/recompensa';
import { claveCanje } from '../../../../core/recompensas.service';
import { calcularTotales } from '../../../../shared/precios';
import { TEXTO_TIPO } from '../../../../shared/sala-layout';

interface PagoModelo {
  cupon: '' | Cupon;
  usarCredito: boolean;
  email: string;
  titular: string;
  numero: string;
  vencimiento: string;   // MM/AA
  cvv: string;
}

// Título del recuadro de error según el paso donde falló confirmar_compra
const TITULO_PASO: Record<PasoError, string> = {
  funcion: 'Función',
  comprador: 'Tus datos',
  edad: 'Edad',
  reserva: 'Butacas',
  butaca: 'Butacas',
  candy: 'Candy',
  puntos: 'Puntos',
  cupon: 'Cupón',
  credito: 'Crédito',
  pago: 'Pago',
  precio: 'Precios',
};

/**
 * Resumen, descuentos y pago simulado (HU-26).
 * Calcula los totales para mostrarlos; el importe real lo calcula confirmar_compra en la base.
 */
@Component({
  selector: 'app-paso-pago',
  imports: [DecimalPipe, FormField],
  templateUrl: './paso-pago.html',
  styleUrl: './paso-pago.css',
})
export class PasoPago {
  entradas = input.required<LineaEntrada[]>();
  items = input.required<ItemCarrito[]>();
  precioGeneral = input.required<number>();
  registrado = input.required<boolean>();
  cuponPrimeraCompra = input<number | null>(null);                        // % si lo tiene sin usar
  cuponEdad = input<{ porcentaje: number; edadMinima: number } | null>(null);
  creditoDisponible = input(0);
  puntosDisponibles = input(0);
  recompensas = input<ItemCanjeable[]>([]);
  restriccionEdad = input(0);
  enviando = input(false);
  error = input<ErrorCompra | null>(null);

  confirmar = output<DatosPago>();
  volverA = output<'butacas' | 'candy'>();

  readonly textoTipo = TEXTO_TIPO;
  readonly tituloPaso = TITULO_PASO;

  modelo = signal<PagoModelo>({
    cupon: '', usarCredito: false, email: '', titular: '', numero: '', vencimiento: '', cvv: '',
  });

  // ----- Canje de puntos (HU-31): clave del ítem ('entrada', 'producto-3') → cantidad -----
  canjes = signal<Record<string, number>>({});

  puntosUsados = computed(() =>
    this.recompensas().reduce((s, r) => s + r.puntos * this.cantidadCanje(r), 0)
  );
  puntosRestantes = computed(() => this.puntosDisponibles() - this.puntosUsados());

  entradasCanjeadas = computed(() =>
    this.recompensas().filter(r => r.tipo === 'entrada').reduce((s, r) => s + this.cantidadCanje(r), 0)
  );

  // Productos canjeados, para mostrarlos en el resumen (se retiran a $0)
  productosCanjeados = computed(() =>
    this.recompensas()
      .filter(r => r.tipo === 'producto' && this.cantidadCanje(r) > 0)
      .map(r => ({ nombre: r.nombre, cantidad: this.cantidadCanje(r), puntos: r.puntos * this.cantidadCanje(r) }))
  );

  // Las entradas que se pueden canjear: las butacas que no cubre ya un combo
  private entradasSinCubrir = computed(() =>
    this.entradas().length - this.items().filter(i => i.incluyeEntrada).reduce((s, i) => s + i.cantidad, 0)
  );

  readonly claveCanje = claveCanje;

  cantidadCanje(r: ItemCanjeable): number {
    return this.canjes()[claveCanje(r)] ?? 0;
  }

  puedeSumarCanje(r: ItemCanjeable): boolean {
    if (this.cantidadCanje(r) >= 20 || this.puntosRestantes() < r.puntos) return false;
    return r.tipo !== 'entrada' || this.entradasCanjeadas() < this.entradasSinCubrir();
  }

  cambiarCanje(r: ItemCanjeable, delta: number) {
    const nueva = Math.max(0, this.cantidadCanje(r) + delta);
    this.canjes.update(c => ({ ...c, [claveCanje(r)]: nueva }));
  }

  private porcentajeCupon = computed(() => {
    const c = this.modelo().cupon;
    if (c === 'primera_compra') return this.cuponPrimeraCompra();
    if (c === 'edad') return this.cuponEdad()?.porcentaje ?? null;
    return null;
  });

  totales = computed(() =>
    calcularTotales(
      this.entradas(), this.items(), this.precioGeneral(), this.entradasCanjeadas(),
      this.porcentajeCupon(), this.modelo().usarCredito, this.creditoDisponible(),
    )
  );

  hayVip = computed(() => this.entradas().some(e => e.butaca.tipo === 'vip'));
  hayCupones = computed(() => this.cuponPrimeraCompra() !== null || this.cuponEdad() !== null);
  hayQuePagar = computed(() => this.totales().total > 0);

  f = form(this.modelo, (s) => {
    // Mail: solo para anónimos
    validate(s.email, ({ value }) =>
      !this.registrado() && value().trim() === '' ? { kind: 'requerido', message: 'Ingresá tu mail' } : null
    );
    email(s.email, { message: 'El mail no es válido' });

    // Tarjeta: solo si queda algo por pagar después de cupón y crédito
    validate(s.titular, ({ value }) =>
      this.hayQuePagar() && value().trim().length < 3 ? { kind: 'titular', message: 'Ingresá el nombre como figura en la tarjeta' } : null
    );
    validate(s.numero, ({ value }) =>
      this.hayQuePagar() && !/^\d{16}$/.test(value().replace(/\s/g, ''))
        ? { kind: 'numero', message: 'El número tiene que tener 16 dígitos' } : null
    );
    validate(s.vencimiento, ({ value }) =>
      this.hayQuePagar() ? this.validarVencimiento(value()) : null
    );
    validate(s.cvv, ({ value }) =>
      this.hayQuePagar() && !/^\d{3,4}$/.test(value()) ? { kind: 'cvv', message: 'El código tiene 3 o 4 dígitos' } : null
    );
  });

  private validarVencimiento(v: string) {
    const m = /^(\d{2})\/(\d{2})$/.exec(v.trim());
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) {
      return { kind: 'vencimiento', message: 'Usá el formato MM/AA' };
    }
    const hoy = new Date();
    const vence = (2000 + Number(m[2])) * 12 + Number(m[1]);
    const actual = hoy.getFullYear() * 12 + hoy.getMonth() + 1;
    return vence < actual ? { kind: 'vencida', message: 'La tarjeta está vencida' } : null;
  }

  enviar(event: Event) {
    event.preventDefault();
    if (this.f().invalid() || this.enviando()) return;

    const m = this.modelo();
    const numero = m.numero.replace(/\s/g, '');
    this.confirmar.emit({
      canjes: this.recompensas()
        .filter(r => this.cantidadCanje(r) > 0)
        .map(r => ({ tipo: r.tipo, productoId: r.producto_id, cantidad: this.cantidadCanje(r) })),
      cupon: m.cupon || null,
      credito: this.totales().credito,
      email: this.registrado() ? null : m.email.trim(),
      // Pago simulado: no se guarda la tarjeta, solo cómo se pagó
      medioPago: this.hayQuePagar() ? `Tarjeta terminada en ${numero.slice(-4)}` : null,
    });
  }
}
