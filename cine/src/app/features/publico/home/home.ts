import { DatePipe, NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alertas as AlertasService } from '../../../services/alertas';
import { Auth as AuthService } from '../../../services/auth';
import { Peliculas as PeliculasService } from '../../../services/peliculas';
import { CatalogoVivo as CatalogoVivoService } from '../../../services/catalogo-vivo';
import { alCambiar } from '../../../shared/al-cambiar';

import { PeliculaConVenta } from '../../../models/pelicula';
import { TarjetaPelicula } from '../../../shared/componentes/tarjeta-pelicula/tarjeta-pelicula';
import { mensajeDeError } from '../../../shared/errores';
import { SoloRolDirective } from '../../../directivas/solo-rol.directive';

// Ignora mayúsculas y tildes: "amelie" encuentra "Amélie"
const normalizar = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

@Component({
  selector: 'app-home',
  imports: [DatePipe, NgClass, RouterLink, TarjetaPelicula, SoloRolDirective],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private service = inject(PeliculasService);
  private alertasService = inject(AlertasService);
  private auth = inject(AuthService);
  private vivo = inject(CatalogoVivoService);

  peliculas = signal<PeliculaConVenta[]>([]);
  busqueda = signal('');
  generosElegidos = signal<string[]>([]);
  cargando = signal(true);
  error = signal('');

  // Las 3 más vendidas (la lista ya llega ordenada por ventas). Sin ventas, no hay ranking.
  top3 = computed(() =>
    this.peliculas().filter(p => p.vendidas > 0).slice(0, 3).map(p => p.id)
  );

  // Solo se ofrecen los géneros que existen en la cartelera actual
  generosDisponibles = computed(() =>
    [...new Set(this.peliculas().flatMap(p => p.generos))].sort((a, b) => a.localeCompare(b, 'es'))
  );

  filtradas = computed(() => {
    const texto = normalizar(this.busqueda().trim());
    const elegidos = this.generosElegidos();
    return this.peliculas().filter(p =>
      normalizar(p.nombre).includes(texto) &&
      elegidos.every(g => p.generos.includes(g))   // cambiá a some() para "cualquiera"
    );
  });

  // ----- HU-11: Próximamente -----
  proximas = signal<PeliculaConVenta[]>([]);
  alertas = signal<Set<number>>(new Set());   // películas con alerta activa del cliente
  alertaEnCurso = signal<number | null>(null);
  errorAlerta = signal('');
  esCliente = computed(() => this.auth.rol() === 'cliente');

  hayFiltros = computed(() => this.busqueda().trim() !== '' || this.generosElegidos().length > 0);

  constructor() {
    this.cargar();
    // Si el admin cambia una película (cartelera / próximamente / oculta, preventa...),
    // la cartelera y Próximamente se actualizan solas, sin recargar la página
    alCambiar(() => this.vivo.peliculas(), () => this.recargarPeliculas());
  }

  private async cargar() {
    try {
      this.peliculas.set(await this.service.listarCartelera());
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo cargar la cartelera'));
    } finally {
      this.cargando.set(false);
    }

    // Próximamente es secundario: si falla, la cartelera se ve igual
    try {
      this.proximas.set(await this.service.listarProximamente());
      await this.auth.inicializada;
      if (this.esCliente()) this.alertas.set(new Set(await this.alertasService.misAlertas()));
    } catch {
      /* sin sección Próximamente */
    }
  }

  async alternarAlerta(peliculaId: number) {
    this.errorAlerta.set('');
    this.alertaEnCurso.set(peliculaId);
    try {
      if (this.alertas().has(peliculaId)) {
        await this.alertasService.desactivar(peliculaId);
        this.alertas.update(s => { const n = new Set(s); n.delete(peliculaId); return n; });
      } else {
        await this.alertasService.activar(peliculaId);
        this.alertas.update(s => new Set(s).add(peliculaId));
      }
    } catch (e) {
      this.errorAlerta.set(mensajeDeError(e, 'No se pudo cambiar la alerta'));
    } finally {
      this.alertaEnCurso.set(null);
    }
  }

  alternarGenero(genero: string) {
    this.generosElegidos.update(lista =>
      lista.includes(genero) ? lista.filter(g => g !== genero) : [...lista, genero]
    );
  }

  limpiarFiltros() {
    this.busqueda.set('');
    this.generosElegidos.set([]);
  }

  // Recarga sin mostrar "Cargando...": la pantalla cambia sola, sin parpadeos
  private async recargarPeliculas() {
    try {
      const [cartelera, proximas] = await Promise.all([
        this.service.listarCartelera(),
        this.service.listarProximamente(),
      ]);
      this.peliculas.set(cartelera);
      this.proximas.set(proximas);
    } catch {
      /* si falla, se sigue viendo lo anterior */
    }
  }
}
