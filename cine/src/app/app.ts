import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { AlertasService } from './core/alertas.service';
import { AuthService } from './core/auth.service';
import { AvisoVenta } from './models/alerta';

const CADA_UN_MINUTO = 60_000;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);
  private alertas = inject(AlertasService);

  /**
   * HU-11: películas con alerta cuya venta abrió. Sin mails, el aviso aparece acá.
   * Mientras hay un cliente logueado se revisa:
   *  - al iniciar sesión;
   *  - al instante, cuando cambia una película (Realtime: el admin abrió la venta o la preventa);
   *  - cada minuto y al volver a la pestaña (la preventa también abre sola al llegar la fecha).
   */
  avisos = signal<AvisoVenta[]>([]);
  private canal: RealtimeChannel | null = null;
  private reloj: ReturnType<typeof setInterval> | null = null;
  private demora: ReturnType<typeof setTimeout> | null = null;
  private alVolver = () => { if (document.visibilityState === 'visible') this.revisarAvisos(); };

  constructor() {
    effect(() => {
      const perfil = this.auth.perfil();
      if (perfil?.rol === 'cliente') this.empezarAvisos();
      else this.detenerAvisos();
    });
    inject(DestroyRef).onDestroy(() => this.detenerAvisos());
  }

  private empezarAvisos() {
    if (this.canal) return;   // ya está escuchando
    this.revisarAvisos();
    // Cada compra también actualiza la película (ventas): se agrupan los cambios seguidos en una sola consulta
    this.canal = this.alertas.escucharPeliculas(() => {
      if (this.demora) clearTimeout(this.demora);
      this.demora = setTimeout(() => this.revisarAvisos(), 1500);
    });
    this.reloj = setInterval(() => this.revisarAvisos(), CADA_UN_MINUTO);
    document.addEventListener('visibilitychange', this.alVolver);
  }

  private detenerAvisos() {
    if (this.canal) this.alertas.dejarDeEscuchar(this.canal);
    if (this.reloj) clearInterval(this.reloj);
    if (this.demora) clearTimeout(this.demora);
    document.removeEventListener('visibilitychange', this.alVolver);
    this.canal = null;
    this.reloj = null;
    this.demora = null;
    this.avisos.set([]);
  }

  // La base devuelve solo los avisos nuevos (los marca como avisados): se suman a los que ya se ven
  private revisarAvisos() {
    this.alertas.avisosPendientes()
      .then(nuevos => {
        if (nuevos.length === 0) return;
        this.avisos.update(actuales => [
          ...actuales,
          ...nuevos.filter(n => !actuales.some(a => a.pelicula_id === n.pelicula_id)),
        ]);
      })
      .catch(() => { /* sin avisos no se rompe nada */ });
  }

  cerrarAviso(peliculaId: number) {
    this.avisos.update(a => a.filter(x => x.pelicula_id !== peliculaId));
  }

  async salir() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
