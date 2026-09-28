import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Alertas as AlertasService } from './services/alertas';
import { Auth as AuthService } from './services/auth';
import { CatalogoVivo as CatalogoVivoService } from './services/catalogo-vivo';
import { alCambiar } from './shared/al-cambiar';
import { AvisoVenta } from './models/alerta';
import { SoloRolDirective } from './directivas/solo-rol.directive';

const CADA_UN_MINUTO = 60_000;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SoloRolDirective],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);
  private alertas = inject(AlertasService);
  private vivo = inject(CatalogoVivoService);

  /**
   * HU-11: películas con alerta cuya venta abrió. Sin mails, el aviso aparece acá.
   * Mientras hay un cliente logueado se revisa:
   *  - al iniciar sesión;
   *  - al instante, cuando cambia una película (catálogo en vivo: el admin abrió la venta o la preventa);
   *  - cada minuto y al volver a la pestaña (la preventa también abre sola al llegar la fecha).
   */
  // Menú desplegable en celular (se cierra al elegir una opción)
  menuAbierto = signal(false);

  avisos = signal<AvisoVenta[]>([]);
  private escuchando = false;
  private reloj: ReturnType<typeof setInterval> | null = null;
  private alVolver = () => { if (document.visibilityState === 'visible') this.revisarAvisos(); };

  constructor() {
    effect(() => {
      const perfil = this.auth.perfil();
      if (perfil?.rol === 'cliente') this.empezarAvisos();
      else this.detenerAvisos();
    });
    inject(DestroyRef).onDestroy(() => this.detenerAvisos());
    alCambiar(() => this.vivo.peliculas(), () => { if (this.escuchando) this.revisarAvisos(); });
  }

  private empezarAvisos() {
    if (this.escuchando) return;
    this.escuchando = true;
    this.revisarAvisos();
    this.reloj = setInterval(() => this.revisarAvisos(), CADA_UN_MINUTO);
    document.addEventListener('visibilitychange', this.alVolver);
  }

  private detenerAvisos() {
    if (this.reloj) clearInterval(this.reloj);
    document.removeEventListener('visibilitychange', this.alVolver);
    this.escuchando = false;
    this.reloj = null;
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
