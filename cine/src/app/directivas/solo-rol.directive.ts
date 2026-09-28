import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { Auth as AuthService } from '../services/auth';
import { Rol } from '../models/perfil';

// 'invitado' = sin sesión
export type RolVisible = Rol | 'invitado';

/**
 * Directiva estructural: muestra el bloque solo a los roles indicados.
 * Como la directiva appAdmin de clase, pero con el rol real de la sesión: si el usuario
 * inicia o cierra sesión, el bloque aparece o desaparece solo (lee la señal auth.rol()).
 *
 * Uso: <a *appSoloRol="['cliente', 'invitado']">Comprar</a>
 * Es solo visual: la seguridad real está en los guards y en la base.
 */
@Directive({
  selector: '[appSoloRol]',
})
export class SoloRolDirective {
  private template = inject(TemplateRef<unknown>);
  private vista = inject(ViewContainerRef);
  private auth = inject(AuthService);

  appSoloRol = input.required<RolVisible[]>();

  private mostrando = false;

  constructor() {
    effect(() => {
      const rol: RolVisible = this.auth.rol() ?? 'invitado';
      const mostrar = this.appSoloRol().includes(rol);
      if (mostrar && !this.mostrando) {
        this.vista.createEmbeddedView(this.template);
        this.mostrando = true;
      } else if (!mostrar && this.mostrando) {
        this.vista.clear();
        this.mostrando = false;
      }
    });
  }
}
