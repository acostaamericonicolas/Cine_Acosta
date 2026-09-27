import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AuthService } from '../../../core/auth.service';
import { CatalogoVivoService } from '../../../core/catalogo-vivo.service';
import { alCambiar } from '../../../shared/al-cambiar';

import { CandyService } from '../../../core/candy.service';
import { CombosService } from '../../../core/combos.service';
import { ComprasService } from '../../../core/compras.service';
import { CuponesService } from '../../../core/cupones.service';
import { FuncionesService } from '../../../core/funciones.service';
import { PeliculasService } from '../../../core/peliculas.service';
import { RecompensasService } from '../../../core/recompensas.service';
import { ReservasService } from '../../../core/reservas.service';
import { SalasService } from '../../../core/salas.service';
import { ButacaOcupada } from '../../../models/butaca-ocupada';
import { CategoriaCandy, ProductoCandy } from '../../../models/candy';
import { ComboConDetalle } from '../../../models/combo';
import { DatosPago, ErrorCompra, ItemCarrito, LineaEntrada, ResultadoCompra } from '../../../models/compra';
import { Funcion } from '../../../models/funcion';
import { PeliculaConVenta } from '../../../models/pelicula';
import { ItemCanjeable } from '../../../models/recompensa';
import { Precios } from '../../../models/sala';
import { MapaButacas } from '../../../shared/componentes/mapa-butacas/mapa-butacas';
import { edad, fechaLocal } from '../../../shared/fechas';
import { precioEntrada } from '../../../shared/precios';
import { BUTACAS, Butaca, TEXTO_TIPO } from '../../../shared/sala-layout';
import { CodigoQr } from '../../../shared/componentes/codigo-qr/codigo-qr';
import { PasoCandy, claveCombo, claveProducto } from './paso-candy/paso-candy';
import { PasoPago } from './paso-pago/paso-pago';

type Paso = 'acceso' | 'edad' | 'butacas' | 'candy' | 'pago' | 'listo';

const idDe = (fila: string, numero: number) => `${fila}-${numero}`;

@Component({
  selector: 'app-compra',
  imports: [DatePipe, DecimalPipe, RouterLink, FormField, MapaButacas, PasoCandy, PasoPago, CodigoQr],
  templateUrl: './compra.html',
  styleUrl: './compra.css',
})
export class Compra {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private funcionesService = inject(FuncionesService);
  private peliculasService = inject(PeliculasService);
  private salasService = inject(SalasService);
  private candyService = inject(CandyService);
  private combosService = inject(CombosService);
  private cuponesService = inject(CuponesService);
  private comprasService = inject(ComprasService);
  private recompensasService = inject(RecompensasService);
  private reservas = inject(ReservasService);
  private vivo = inject(CatalogoVivoService);
  private hoy = fechaLocal();

  readonly textoTipo = TEXTO_TIPO;

  paso = signal<Paso>('butacas');
  funcion = signal<Funcion | null>(null);
  pelicula = signal<PeliculaConVenta | null>(null);
  precios = signal<Precios>({ general: 0, accesible: 0, vip: 0 });
  deshabilitadas = signal<string[]>([]);

  cargando = signal(true);
  error = signal('');         // la compra no se puede hacer (función pasada, venta cerrada, edad...)
  aviso = signal('');         // error al tocar una butaca (el mensaje viene de la base)
  procesando = signal<string | null>(null);

  // ----- Paso acceso: el que no inició sesión elige cómo comprar -----
  registrado = computed(() => this.auth.logueado());
  // Después de ingresar o registrarse, vuelve a esta misma compra
  volverAca = computed(() => `/comprar/${this.funcionId}`);

  // ----- Paso edad (HU-24) -----
  modeloEdad = signal({ fechaNacimiento: '' });
  fEdad = form(this.modeloEdad, (s) => {
    required(s.fechaNacimiento, { message: 'Ingresá tu fecha de nacimiento' });
    validate(s.fechaNacimiento, ({ value }) =>
      value() > this.hoy ? { kind: 'fecha-futura', message: 'La fecha no puede ser futura' } : null
    );
  });
  avisoEdad = signal('');

  // ----- Paso butacas (HU-22, HU-23) -----
  // Butacas tomadas en la función, por id 'J-10'. Se actualiza con Realtime.
  private ocupadas = signal<Map<string, ButacaOcupada>>(new Map());
  private miHash = signal('');
  private ahora = signal(Date.now());

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

  lineas = computed<LineaEntrada[]>(() => {
    const p = this.pelicula();
    if (!p) return [];
    return this.seleccionadas().map(b => ({ butaca: b, precio: precioEntrada(b.tipo, this.precios(), p) }));
  });

  totalEntradas = computed(() => this.lineas().reduce((suma, l) => suma + l.precio, 0));
  hayVip = computed(() => this.seleccionadas().some(b => b.tipo === 'vip'));

  // Precio de la entrada general hoy (con preventa): lo cubre cada combo con entrada
  precioGeneral = computed(() => {
    const p = this.pelicula();
    return p ? precioEntrada('general', this.precios(), p) : 0;
  });

  // Todas mis reservas vencen juntas (la base les pone el mismo vencimiento)
  private segundosRestantes = computed(() => {
    const mias = this.vigentes().filter(o => o.token_hash === this.miHash() && o.vence);
    if (mias.length === 0) return null;
    const vence = Math.min(...mias.map(o => Date.parse(o.vence!)));
    return Math.max(0, Math.floor((vence - this.ahora()) / 1000));
  });

  tiempoRestante = computed(() => {
    const s = this.segundosRestantes();
    return s === null ? null : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  });

  // ----- Paso candy (HU-25) -----
  categorias = signal<CategoriaCandy[]>([]);
  productos = signal<ProductoCandy[]>([]);
  combos = signal<ComboConDetalle[]>([]);
  cantidades = signal<Record<string, number>>({});
  errorCandy = signal('');

  carrito = computed<ItemCarrito[]>(() => {
    const c = this.cantidades();
    return [
      ...this.combos()
        .filter(x => (c[claveCombo(x.id)] ?? 0) > 0)
        .map(x => ({
          tipo: 'combo' as const, id: x.id, nombre: x.nombre, precio: Number(x.precio),
          cantidad: c[claveCombo(x.id)], incluyeEntrada: x.incluye_entrada,
        })),
      ...this.productos()
        .filter(x => (c[claveProducto(x.id)] ?? 0) > 0)
        .map(x => ({
          tipo: 'producto' as const, id: x.id, nombre: x.nombre, precio: Number(x.precio),
          cantidad: c[claveProducto(x.id)], incluyeEntrada: false,
        })),
    ];
  });

  combosConEntrada = computed(() =>
    this.carrito().filter(i => i.incluyeEntrada).reduce((s, i) => s + i.cantidad, 0)
  );
  candyValido = computed(() => this.combosConEntrada() <= this.seleccionadas().length);

  // ----- Paso pago (HU-26) -----
  cuponPrimeraCompra = signal<number | null>(null);
  cuponEdad = signal<{ porcentaje: number; edadMinima: number } | null>(null);
  creditoDisponible = computed(() => Number(this.auth.perfil()?.credito ?? 0));
  puntosDisponibles = computed(() => this.auth.perfil()?.puntos ?? 0);
  recompensas = signal<ItemCanjeable[]>([]);
  enviando = signal(false);
  errorCompra = signal<ErrorCompra | null>(null);
  resultado = signal<ResultadoCompra | null>(null);

  private canal: RealtimeChannel | null = null;
  private funcionId = Number(this.route.snapshot.paramMap.get('funcionId'));

  constructor() {
    const reloj = setInterval(() => this.ahora.set(Date.now()), 1000);

    inject(DestroyRef).onDestroy(() => {
      clearInterval(reloj);
      if (this.canal) this.reservas.dejarDeEscuchar(this.canal);
      // Si se va sin comprar, las butacas quedan libres para otros (si falla, vencen solas)
      if (this.paso() !== 'listo' && this.idsSeleccionadas().length > 0) {
        this.reservas.liberarTodas(this.funcionId).catch(() => { });
      }
    });

    this.cargar();

    // Catálogo en vivo: si el admin cambia algo mientras se compra, la pantalla se entera
    alCambiar(() => this.vivo.peliculas(), () => this.revisarPelicula());
    alCambiar(() => this.vivo.candy(), () => this.recargarCandy());
    alCambiar(() => this.vivo.precios(), () => this.recargarPrecios());
  }

  private async cargar() {
    try {
      if (!Number.isInteger(this.funcionId) || this.funcionId <= 0) throw new Error('La función no existe.');

      await this.auth.inicializada;   // hace falta saber si hay sesión para el control de edad
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

      this.pasoInicial(pelicula);

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

  // Sin sesión: primero elige si ingresa, se registra o sigue como invitado (RF-02).
  // HU-24: con restricción, el registrado se controla con su perfil y el invitado declara su fecha.
  private pasoInicial(p: PeliculaConVenta) {
    const perfil = this.auth.perfil();
    if (!perfil) return this.paso.set('acceso');
    // RF-30/33: las cuentas del personal no compran (la base también lo rechaza)
    if (perfil.rol !== 'cliente') {
      throw new Error('Estás con una cuenta del personal. Para comprar, cerrá sesión y comprá como invitado o con una cuenta de cliente.');
    }
    if (p.restriccion_edad === 0) return this.paso.set('butacas');

    const anios = edad(perfil.fecha_nacimiento, this.hoy);
    if (anios < p.restriccion_edad) {
      throw new Error(`"${p.nombre}" es para mayores de ${p.restriccion_edad} años y tu perfil indica ${anios} años.`);
    }
    this.paso.set('butacas');
  }

  seguirComoInvitado() {
    this.paso.set(this.pelicula()!.restriccion_edad > 0 ? 'edad' : 'butacas');
  }

  continuarDesdeEdad(event: Event) {
    event.preventDefault();
    if (this.fEdad().invalid()) return;
    const p = this.pelicula()!;
    const anios = edad(this.modeloEdad().fechaNacimiento, this.hoy);
    if (anios < p.restriccion_edad) {
      this.avisoEdad.set(`"${p.nombre}" es para mayores de ${p.restriccion_edad} años. No podés comprar entradas para esta película.`);
      return;
    }
    this.avisoEdad.set('');
    this.paso.set('butacas');
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

  // ----- Navegación entre pasos -----
  async irACandy() {
    this.paso.set('candy');
    if (this.categorias().length > 0 || this.combos().length > 0) return;   // ya cargado
    try {
      const [categorias, productos, combos] = await Promise.all([
        this.candyService.listarCategorias(),
        this.candyService.listarProductosActivos(),
        this.combosService.listarActivosConDetalle(),
      ]);
      this.categorias.set(categorias);
      this.productos.set(productos);
      this.combos.set(combos);
    } catch (e) {
      this.errorCandy.set((e as { message?: string }).message ?? 'No se pudo cargar el candy');
    }
  }

  cambiarCantidad(c: { clave: string; cantidad: number }) {
    this.cantidades.update(actual => ({ ...actual, [c.clave]: c.cantidad }));
  }

  async irAPago() {
    this.paso.set('pago');
    this.errorCompra.set(null);
    if (!this.registrado()) return;

    // Crédito, puntos y cupones se releen: pudieron cambiar desde el login
    try {
      await this.auth.refrescarPerfil();
      const perfil = this.auth.perfil()!;
      const [primera, porEdad, recompensas] = await Promise.all([
        this.cuponesService.obtenerCuponPrimeraCompra(perfil.id),
        this.cuponesService.listarPorEdad(),
        this.recompensasService.canjeables(),
      ]);
      this.recompensas.set(recompensas);
      this.cuponPrimeraCompra.set(primera && !primera.usado ? Number(primera.porcentaje) : null);

      const anios = edad(perfil.fecha_nacimiento, this.hoy);
      const mejor = porEdad
        .filter(c => c.activo && c.vigente_desde <= this.hoy && this.hoy <= c.vigente_hasta && anios >= c.edad_minima)
        .sort((a, b) => b.porcentaje - a.porcentaje)[0];
      this.cuponEdad.set(mejor ? { porcentaje: Number(mejor.porcentaje), edadMinima: mejor.edad_minima } : null);
    } catch {
      // Sin cupones ni canjes se puede comprar igual; la base valida todo al confirmar
    }
  }

  volverA(paso: 'butacas' | 'candy') {
    this.errorCompra.set(null);
    if (paso === 'candy') this.irACandy();
    else this.paso.set('butacas');
  }

  async confirmar(pago: DatosPago) {
    this.enviando.set(true);
    this.errorCompra.set(null);
    try {
      const r = await this.comprasService.confirmar(
        this.funcionId,
        this.idsSeleccionadas(),
        this.carrito(),
        pago,
        this.registrado() ? null : this.modeloEdad().fechaNacimiento || null,
      );
      this.resultado.set(r);
      this.paso.set('listo');
      if (!this.registrado()) this.comprasService.recordarMail(r.codigo, r.email);   // para abrir el comprobante sin volver a pedirlo
      if (this.registrado()) this.auth.refrescarPerfil().catch(() => { });   // crédito y puntos nuevos
    } catch (e) {
      this.errorCompra.set(e as ErrorCompra);
    } finally {
      this.enviando.set(false);
    }
  }

  // ----- Catálogo en vivo -----

  // Si la película se ocultó o se cerró la venta mientras se compraba, se avisa y se sueltan las butacas
  private async revisarPelicula() {
    const funcion = this.funcion();
    if (!funcion || this.paso() === 'listo') return;
    let motivo = '';
    try {
      const p = await this.peliculasService.obtenerConVenta(funcion.pelicula_id);
      this.pelicula.set(p);
      if (!p.venta_abierta) motivo = `Se cerró la venta de entradas para "${p.nombre}" mientras comprabas.`;
    } catch {
      motivo = 'La película ya no está disponible.';
    }
    if (motivo) {
      this.error.set(motivo);
      if (this.idsSeleccionadas().length > 0) this.reservas.liberarTodas(this.funcionId).catch(() => { });
    }
  }

  // Combo o producto dado de baja / de alta, o cambio de precio: se recarga el catálogo del candy.
  // Lo que ya no está activo desaparece solo del carrito (carrito es un computed sobre estas listas).
  private async recargarCandy() {
    if (this.categorias().length === 0 && this.combos().length === 0) return;   // todavía no abrió el candy
    try {
      const [categorias, productos, combos] = await Promise.all([
        this.candyService.listarCategorias(),
        this.candyService.listarProductosActivos(),
        this.combosService.listarActivosConDetalle(),
      ]);
      this.categorias.set(categorias);
      this.productos.set(productos);
      this.combos.set(combos);
      if (this.paso() === 'pago' && this.registrado()) {
        this.recompensas.set(await this.recompensasService.canjeables());
      }
    } catch {
      /* se sigue viendo lo anterior; la base valida todo al confirmar */
    }
  }

  private async recargarPrecios() {
    try {
      this.precios.set(await this.salasService.precios());
    } catch {
      /* se siguen viendo los anteriores; el precio real lo calcula la base */
    }
  }
}
