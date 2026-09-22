import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, FormField, required, min, maxLength } from '@angular/forms/signals';
import { ConCambios } from '../../../core/guards/cambios.guard';
import {
  CandyService, CategoriaCandy, MAX_IMAGEN_BYTES, ProductoNuevo, TIPOS_IMAGEN,
} from '../../../core/candy.service';

interface ProductoModelo {
  nombre: string;
  categoriaId: string;
  precio: number;
  activo: boolean;
}

@Component({
  selector: 'app-producto-form',
  imports: [FormField, RouterLink],
  templateUrl: './producto-form.html',
  styleUrl: './producto-form.css',
})
export class ProductoForm implements ConCambios {
  private service = inject(CandyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  id: number | null = null;
  categorias = signal<CategoriaCandy[]>([]);

  modelo = signal<ProductoModelo>({ nombre: '', categoriaId: '', precio: 0, activo: true });
  private inicial = JSON.stringify(this.modelo());
  private guardado = false;

  f = form(this.modelo, (s) => {
    required(s.nombre, { message: 'Ingresá el nombre' });
    maxLength(s.nombre, 60, { message: 'Máximo 60 caracteres' });
    required(s.categoriaId, { message: 'Elegí una categoría' });
    min(s.precio, 1, { message: 'Ingresá un precio mayor a 0' });
  });

  archivo = signal<File | null>(null);
  vistaPrevia = signal<string | null>(null);
  imagenActualUrl = signal<string | null>(null);
  private imagenPathActual: string | null = null;
  errorImagen = signal('');

  imagenMostrada = computed(() => this.vistaPrevia() ?? this.imagenActualUrl());

  cargando = signal(true);
  guardando = signal(false);
  error = signal('');

  puedeGuardar = computed(() => this.f().valid() && this.imagenMostrada() !== null && !this.guardando());

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.id = Number(id);
    this.cargar();
    inject(DestroyRef).onDestroy(() => this.limpiarVistaPrevia());
  }

  private async cargar() {
    try {
      this.categorias.set(await this.service.listarCategorias());
      if (this.id !== null) {
        const p = await this.service.obtenerProducto(this.id);
        const m: ProductoModelo = {
          nombre: p.nombre, categoriaId: String(p.categoria_id), precio: p.precio, activo: p.activo,
        };
        this.modelo.set(m);
        this.inicial = JSON.stringify(m);
        this.imagenActualUrl.set(p.imagen_url);
        this.imagenPathActual = p.imagen_path;
      }
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudieron cargar los datos'));
    } finally {
      this.cargando.set(false);
    }
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
    return !this.guardado && (this.archivo() !== null || JSON.stringify(this.modelo()) !== this.inicial);
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
        const r = await this.service.subirImagen(archivo);
        subido = r.path;
        imagenUrl = r.url;
        imagenPath = r.path;
      }

      const m = this.modelo();
      const datos: ProductoNuevo = {
        nombre: m.nombre.trim(),
        categoria_id: Number(m.categoriaId),
        precio: m.precio,
        imagen_url: imagenUrl,
        imagen_path: imagenPath,
        activo: m.activo,
      };

      if (this.id === null) {
        await this.service.crearProducto(datos);
      } else {
        await this.service.actualizarProducto(this.id, datos);
      }

      if (subido && this.imagenPathActual) {
        await this.service.eliminarImagen(this.imagenPathActual).catch(() => { });
      }

      this.guardado = true;
      this.router.navigate(['/admin/candy/productos']);
    } catch (e) {
      if (subido) await this.service.eliminarImagen(subido).catch(() => { });
      this.error.set(this.texto(e, 'No se pudo guardar'));
    } finally {
      this.guardando.set(false);
    }
  }

  private texto(e: unknown, defecto: string): string {
    return (e as { message?: string }).message ?? defecto;
  }
}