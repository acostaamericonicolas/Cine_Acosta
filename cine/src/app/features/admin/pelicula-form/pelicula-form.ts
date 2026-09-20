import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  form, FormField, required, min, max, minLength, maxLength, validate,
} from '@angular/forms/signals';
import { ConCambios } from '../../../core/guards/cambios.guard';
import {
  ESTADOS, EstadoPelicula, MAX_IMAGEN_BYTES, PeliculaNueva, PeliculasService, TIPOS_IMAGEN,
} from '../../../core/peliculas.service';
import { GENEROS } from '../../../shared/generos';

interface PeliculaModelo {
  nombre: string;
  sinopsis: string;
  duracionMin: number;
  generos: string[];
  restriccion: string;   // '0' | '13' | '18' (los select trabajan con texto)
  estado: string;
  fechaEstreno: string;
}

@Component({
  selector: 'app-pelicula-form',
  imports: [FormField, RouterLink],
  templateUrl: './pelicula-form.html',
  styleUrl: './pelicula-form.css',
})
export class PeliculaForm implements ConCambios {
  private service = inject(PeliculasService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  readonly generosDisponibles = GENEROS;
  readonly estados = ESTADOS;
  readonly restricciones = [
    { valor: '0', texto: 'Apta para todo público' },
    { valor: '13', texto: 'Mayores de 13' },
    { valor: '18', texto: 'Mayores de 18' },
  ];

  id: number | null = null;   // null = película nueva

  modelo = signal<PeliculaModelo>({
    nombre: '',
    sinopsis: '',
    duracionMin: 0,
    generos: [],
    restriccion: '0',
    estado: 'oculta',
    fechaEstreno: '',
  });

  private inicial = JSON.stringify(this.modelo());
  private guardado = false;

  f = form(this.modelo, (s) => {
    required(s.nombre, { message: 'Ingresá el nombre' });
    maxLength(s.nombre, 100, { message: 'Máximo 100 caracteres' });
    required(s.sinopsis, { message: 'Ingresá la sinopsis' });
    minLength(s.sinopsis, 20, { message: 'Mínimo 20 caracteres' });
    maxLength(s.sinopsis, 600, { message: 'Máximo 600 caracteres' });
    min(s.duracionMin, 1, { message: 'Ingresá la duración en minutos' });
    max(s.duracionMin, 600, { message: 'Máximo 600 minutos' });
    validate(s.generos, ({ value }) =>
      value().length === 0 ? { kind: 'sin-generos', message: 'Elegí al menos un género' } : null
    );
    required(s.fechaEstreno, { message: 'Ingresá la fecha de estreno' });
  });

  // --- Póster ---
  archivo = signal<File | null>(null);              // archivo elegido, todavía sin subir
  vistaPrevia = signal<string | null>(null);        // URL temporal del archivo elegido
  imagenActualUrl = signal<string | null>(null);    // póster ya guardado (al editar)
  private imagenPathActual: string | null = null;
  errorImagen = signal('');

  imagenMostrada = computed(() => this.vistaPrevia() ?? this.imagenActualUrl());

  cargando = signal(false);
  guardando = signal(false);
  error = signal('');

  puedeGuardar = computed(
    () => this.f().valid() && this.imagenMostrada() !== null && !this.guardando()
  );

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.id = Number(id);
      this.cargar(this.id);
    }
    // Liberamos la URL temporal al salir de la pantalla
    inject(DestroyRef).onDestroy(() => this.limpiarVistaPrevia());
  }

  private async cargar(id: number) {
    this.cargando.set(true);
    try {
      const p = await this.service.obtener(id);
      const m: PeliculaModelo = {
        nombre: p.nombre,
        sinopsis: p.sinopsis,
        duracionMin: p.duracion_min,
        generos: p.generos,
        restriccion: String(p.restriccion_edad),
        estado: p.estado,
        fechaEstreno: p.fecha_estreno,
      };
      this.modelo.set(m);
      this.inicial = JSON.stringify(m);   // lo que se cargó no cuenta como "cambio"
      this.imagenActualUrl.set(p.imagen_url);
      this.imagenPathActual = p.imagen_path;
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cargar la película');
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

  alternarGenero(genero: string, marcado: boolean) {
    this.modelo.update(m => ({
      ...m,
      generos: marcado ? [...m.generos, genero] : m.generos.filter(g => g !== genero),
    }));
  }

  // Lo consulta cambiosGuard antes de salir de la pantalla
  hayCambios(): boolean {
    return !this.guardado &&
      (this.archivo() !== null || JSON.stringify(this.modelo()) !== this.inicial);
  }

  async guardar(event: Event) {
    event.preventDefault();
    if (!this.puedeGuardar()) return;

    this.guardando.set(true);
    this.error.set('');
    let subido: string | null = null;   // path del archivo nuevo, por si hay que deshacer

    try {
      let imagenUrl = this.imagenActualUrl() ?? '';
      let imagenPath = this.imagenPathActual;

      // 1) Si se eligió un archivo, se sube primero
      const archivo = this.archivo();
      if (archivo) {
        const r = await this.service.subirPoster(archivo);
        subido = r.path;
        imagenUrl = r.url;
        imagenPath = r.path;
      }

      // 2) Se guarda la película con la URL que generó Supabase
      const m = this.modelo();
      const datos: PeliculaNueva = {
        nombre: m.nombre.trim(),
        sinopsis: m.sinopsis.trim(),
        duracion_min: m.duracionMin,
        imagen_url: imagenUrl,
        imagen_path: imagenPath,
        generos: m.generos,
        restriccion_edad: Number(m.restriccion) as 0 | 13 | 18,
        estado: m.estado as EstadoPelicula,
        fecha_estreno: m.fechaEstreno,
      };

      if (this.id === null) {
        await this.service.crear(datos);
      } else {
        await this.service.actualizar(this.id, datos);
      }

      // 3) Si se reemplazó el póster, se borra el anterior (si falla, no es grave)
      if (subido && this.imagenPathActual) {
        await this.service.eliminarPoster(this.imagenPathActual).catch(() => { });
      }

      this.guardado = true;   // para que el guard no pregunte al salir
      this.router.navigate(['/admin/peliculas']);
    } catch (e) {
      // Si el archivo se subió pero la película no se guardó, no dejamos un archivo huérfano
      if (subido) await this.service.eliminarPoster(subido).catch(() => { });
      this.error.set((e as { message?: string }).message ?? 'No se pudo guardar');
    } finally {
      this.guardando.set(false);
    }
  }
}