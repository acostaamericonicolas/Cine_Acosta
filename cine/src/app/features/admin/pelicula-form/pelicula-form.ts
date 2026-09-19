import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  form, FormField, required, min, max, minLength, maxLength, pattern, validate,
} from '@angular/forms/signals';
import { ConCambios } from '../../../core/guards/cambios.guard';
import {
  ESTADOS, EstadoPelicula, PeliculaNueva, PeliculasService,
} from '../../../core/peliculas.service';
import { GENEROS } from '../../../shared/generos';

interface PeliculaModelo {
  nombre: string;
  imagenUrl: string;
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
    imagenUrl: '',
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
    required(s.imagenUrl, { message: 'Ingresá la URL de la imagen' });
    pattern(s.imagenUrl, /^https?:\/\/.+/i, { message: 'Tiene que empezar con http:// o https://' });
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

  cargando = signal(false);
  guardando = signal(false);
  error = signal('');

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.id = Number(id);
      this.cargar(this.id);
    }
  }

  private async cargar(id: number) {
    this.cargando.set(true);
    try {
      const p = await this.service.obtener(id);
      const m: PeliculaModelo = {
        nombre: p.nombre,
        imagenUrl: p.imagen_url,
        sinopsis: p.sinopsis,
        duracionMin: p.duracion_min,
        generos: p.generos,
        restriccion: String(p.restriccion_edad),
        estado: p.estado,
        fechaEstreno: p.fecha_estreno,
      };
      this.modelo.set(m);
      this.inicial = JSON.stringify(m);   // lo que se cargó no cuenta como "cambio"
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cargar la película');
    } finally {
      this.cargando.set(false);
    }
  }

  alternarGenero(genero: string, marcado: boolean) {
    this.modelo.update(m => ({
      ...m,
      generos: marcado ? [...m.generos, genero] : m.generos.filter(g => g !== genero),
    }));
  }

  // Lo consulta cambiosGuard antes de salir de la pantalla
  hayCambios(): boolean {
    return !this.guardado && JSON.stringify(this.modelo()) !== this.inicial;
  }

  async guardar(event: Event) {
    event.preventDefault();
    if (this.f().invalid()) return;

    const m = this.modelo();
    const datos: PeliculaNueva = {
      nombre: m.nombre.trim(),
      sinopsis: m.sinopsis.trim(),
      duracion_min: m.duracionMin,
      imagen_url: m.imagenUrl.trim(),
      generos: m.generos,
      restriccion_edad: Number(m.restriccion) as 0 | 13 | 18,
      estado: m.estado as EstadoPelicula,
      fecha_estreno: m.fechaEstreno,
    };

    this.guardando.set(true);
    this.error.set('');
    try {
      if (this.id === null) {
        await this.service.crear(datos);
      } else {
        await this.service.actualizar(this.id, datos);
      }
      this.guardado = true;   // para que el guard no pregunte al salir
      this.router.navigate(['/admin/peliculas']);
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo guardar');
    } finally {
      this.guardando.set(false);
    }
  }
}