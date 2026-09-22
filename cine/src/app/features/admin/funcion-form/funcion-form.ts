import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, FormField, required, validate } from '@angular/forms/signals';
import { ConCambios } from '../../../core/guards/cambios.guard';
import { Funcion, FuncionesService } from '../../../core/funciones.service';
import { Pelicula, PeliculasService } from '../../../core/peliculas.service';
import { Sala, SalasService } from '../../../core/salas.service';

interface FuncionModelo {
  peliculaId: string;   // los <select> trabajan con texto
  salaId: string;       // solo se usa en modo edición
  fecha: string;
  hora: string;
  formato: string;
  idioma: string;
}

@Component({
  selector: 'app-funcion-form',
  imports: [FormField, RouterLink],
  templateUrl: './funcion-form.html',
  styleUrl: './funcion-form.css',
})
export class FuncionForm implements ConCambios {
  private peliculasService = inject(PeliculasService);
  private funcionesService = inject(FuncionesService);
  private salasService = inject(SalasService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly formatos = ['2D', '3D', '4D', '5D'];
  readonly idiomas = [
    { valor: 'castellano', texto: 'Castellano' },
    { valor: 'subtitulada', texto: 'Subtitulada' },
  ];
  readonly hoy = new Date().toISOString().slice(0, 10);

  id: number | null = null;   // null = función nueva
  get esEdicion() { return this.id !== null; }

  peliculas = signal<Pelicula[]>([]);
  salas = signal<Sala[]>([]);
  cargando = signal(true);
  guardando = signal(false);
  error = signal('');
  exito = signal('');

  modelo = signal<FuncionModelo>({
    peliculaId: '', salaId: '', fecha: '', hora: '', formato: '2D', idioma: 'castellano',
  });

  private inicial = JSON.stringify(this.modelo());
  private guardado = false;

  f = form(this.modelo, (s) => {
    required(s.peliculaId, { message: 'Elegí una película' });
    required(s.fecha, { message: 'Elegí una fecha' });
    required(s.hora, { message: 'Elegí una hora' });
  });

  peliculaElegida = computed(() =>
    this.peliculas().find(p => p.id === Number(this.modelo().peliculaId)) ?? null
  );

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.id = Number(id);
    this.cargar();
  }

  private async cargar() {
    try {
      const [todas, salas] = await Promise.all([
        this.peliculasService.listar(),
        this.salasService.listar(),   // incluye inactivas: si una función quedó en una sala desactivada, hay que poder verla igual
      ]);
      this.peliculas.set(todas.filter(p => p.estado !== 'oculta'));
      this.salas.set(salas);

      if (this.id !== null) {
        const func = await this.funcionesService.obtener(this.id);
        const m: FuncionModelo = {
          peliculaId: String(func.pelicula_id),
          salaId: String(func.sala_id),
          fecha: func.inicio.slice(0, 10),
          hora: new Date(func.inicio).toTimeString().slice(0, 5),
          formato: func.formato,
          idioma: func.idioma,
        };
        this.modelo.set(m);
        this.inicial = JSON.stringify(m);
      }
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudieron cargar los datos'));
    } finally {
      this.cargando.set(false);
    }
  }

  hayCambios(): boolean {
    return !this.guardado && JSON.stringify(this.modelo()) !== this.inicial;
  }

  async guardar(event: Event) {
    event.preventDefault();
    if (this.f().invalid()) return;
    if (this.esEdicion && !this.modelo().salaId) return;

    this.error.set('');
    this.exito.set('');
    this.guardando.set(true);
    try {
      const m = this.modelo();
      // El navegador arma la fecha en horario local y toISOString la pasa a UTC
      const inicio = new Date(`${m.fecha}T${m.hora}`).toISOString();

      if (this.esEdicion) {
        await this.funcionesService.actualizar(this.id!, {
          pelicula_id: Number(m.peliculaId),
          sala_id: Number(m.salaId),
          inicio,
          formato: m.formato as any,
          idioma: m.idioma as any,
        });
        this.guardado = true;
        this.router.navigate(['/admin/funciones']);
      } else {
        const funcion = await this.funcionesService.crearConAsignacionAutomatica({
          pelicula_id: Number(m.peliculaId),
          inicio,
          formato: m.formato as any,
          idioma: m.idioma as any,
        });
        this.exito.set(`Función creada. Se asignó la sala #${funcion.sala_id}.`);
        this.guardado = true;
        // Se limpian solo fecha y hora, para cargar varias funciones seguidas de la misma película
        const limpio = { ...m, fecha: '', hora: '' };
        this.modelo.set(limpio);
        this.inicial = JSON.stringify(limpio);
        this.guardado = false;   // vuelve a activarse el aviso de cambios para la próxima carga
      }
    } catch (e) {
      this.error.set(this.texto(e, 'No se pudo guardar'));
    } finally {
      this.guardando.set(false);
    }
  }

  private texto(e: unknown, defecto: string): string {
    return (e as { message?: string }).message ?? defecto;
  }
}