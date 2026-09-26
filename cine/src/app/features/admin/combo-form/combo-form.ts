import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, FormField, required, min, maxLength } from '@angular/forms/signals';
import { ConCambios } from '../../../core/guards/form-guard';
import { CandyService } from '../../../core/candy.service';
import { ProductoCandy } from '../../../models/candy';
import { CombosService } from '../../../core/combos.service';
import { ItemCombo } from '../../../models/combo';
import { ImagenesService, MAX_IMAGEN_BYTES, TIPOS_IMAGEN } from '../../../core/imagenes.service';

interface ComboModelo {
  nombre: string;
  precio: number;
  incluyeEntrada: boolean;
  activo: boolean;
}

@Component({
  selector: 'app-combo-form',
  imports: [FormField, RouterLink],
  templateUrl: './combo-form.html',
  styleUrl: './combo-form.css',
})
export class ComboForm implements ConCambios {
  private candyService = inject(CandyService);
  private combosService = inject(CombosService);
  private imagenes = inject(ImagenesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  id: number | null = null;
  productos = signal<ProductoCandy[]>([]);

  modelo = signal<ComboModelo>({ nombre: '', precio: 0, incluyeEntrada: true, activo: true });
  items = signal<ItemCombo[]>([]);   // productos elegidos, con cantidad

  private inicial = '';
  private guardado = false;

  f = form(this.modelo, (s) => {
    required(s.nombre, { message: 'Ingresá el nombre' });
    maxLength(s.nombre, 60, { message: 'Máximo 60 caracteres' });
    min(s.precio, 1, { message: 'Ingresá un precio mayor a 0' });
  });

  // --- Imagen (mismo patrón que en pelicula-form y producto-form) ---
  archivo = signal<File | null>(null);
  vistaPrevia = signal<string | null>(null);
  imagenActualUrl = signal<string | null>(null);
  private imagenPathActual: string | null = null;
  errorImagen = signal('');

  imagenMostrada = computed(() => this.vistaPrevia() ?? this.imagenActualUrl());

  cargando = signal(true);
  guardando = signal(false);
  error = signal('');

  puedeGuardar = computed(() =>
    this.f().valid() && this.items().length > 0 && this.imagenMostrada() !== null && !this.guardando()
  );

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.id = Number(id);
    this.cargar();
    inject(DestroyRef).onDestroy(() => this.limpiarVistaPrevia());
  }

  private snapshot(): string {
    return JSON.stringify({ modelo: this.modelo(), items: this.items(), archivo: this.archivo()?.name ?? null });
  }

  private async cargar() {
    try {
      this.productos.set((await this.candyService.listarProductos()).filter(p => p.activo));

      if (this.id !== null) {
        const combo = await this.combosService.obtener(this.id);
        this.modelo.set({
          nombre: combo.nombre, precio: combo.precio,
          incluyeEntrada: combo.incluye_entrada, activo: combo.activo,
        });
        this.items.set(combo.items);
        this.imagenActualUrl.set(combo.imagen_url);
        this.imagenPathActual = combo.imagen_path;
      }
      this.inicial = this.snapshot();
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudieron cargar los datos'));
    } finally {
      this.cargando.set(false);
    }
  }

  estaElegido(productoId: number): boolean {
    return this.items().some(i => i.producto_id === productoId);
  }

  cantidadDe(productoId: number): number {
    return this.items().find(i => i.producto_id === productoId)?.cantidad ?? 1;
  }

  alternarProducto(productoId: number, marcado: boolean) {
    this.items.update(lista =>
      marcado
        ? [...lista, { producto_id: productoId, cantidad: 1 }]
        : lista.filter(i => i.producto_id !== productoId)
    );
  }

  cambiarCantidad(productoId: number, cantidad: number) {
    if (cantidad < 1) cantidad = 1;
    this.items.update(lista => lista.map(i => (i.producto_id === productoId ? { ...i, cantidad } : i)));
  }

  seleccionarArchivo(event: Event) {
    const input = event.target as HTMLInputElement;
    const archivo = input.files?.[0] ?? null;

    this.errorImagen.set('');
    this.limpiarVistaPrevia();
    this.archivo.set(null);
    if (!archivo) return;

    if (!TIPOS_IMAGEN.includes(archivo.type)) {
      this.errorImagen.set('Formato no permitido. Usá JPG, PNG o WebP.');
      input.value = '';
      return;
    }
    if (archivo.size > MAX_IMAGEN_BYTES) {
      this.errorImagen.set('La imagen supera los 2 MB.');
      input.value = '';
      return;
    }

    this.archivo.set(archivo);
    this.vistaPrevia.set(URL.createObjectURL(archivo));
  }

  private limpiarVistaPrevia() {
    const v = this.vistaPrevia();
    if (v) URL.revokeObjectURL(v);
    this.vistaPrevia.set(null);
  }

  hayCambios(): boolean {
    return !this.guardado && this.snapshot() !== this.inicial;
  }

  async guardar(event: Event) {
    event.preventDefault();
    if (!this.puedeGuardar()) return;

    this.guardando.set(true);
    this.error.set('');
    let subido: string | null = null;

    try {
      let imagenUrl = this.imagenActualUrl() ?? '';
      let imagenPath = this.imagenPathActual;

      const archivo = this.archivo();
      if (archivo) {
        const r = await this.imagenes.subir('combos', archivo);
        subido = r.path;
        imagenUrl = r.url;
        imagenPath = r.path;
      }

      const m = this.modelo();
      const datos = {
        nombre: m.nombre.trim(), precio: m.precio,
        incluye_entrada: m.incluyeEntrada, activo: m.activo,
        imagen_url: imagenUrl, imagen_path: imagenPath,
      };

      if (this.id === null) {
        await this.combosService.crear(datos, this.items());
      } else {
        await this.combosService.actualizar(this.id, datos, this.items());
      }

      if (subido && this.imagenPathActual) {
        await this.imagenes.eliminar('combos', this.imagenPathActual).catch(() => { });
      }

      this.guardado = true;
      this.router.navigate(['/admin/combos']);
    } catch (e) {
      if (subido) await this.imagenes.eliminar('combos', subido).catch(() => { });
      this.error.set(this.texto(e, 'No se pudo guardar'));
    } finally {
      this.guardando.set(false);
    }
  }

  private texto(e: unknown, defecto: string): string {
    return (e as { message?: string }).message ?? defecto;
  }
}