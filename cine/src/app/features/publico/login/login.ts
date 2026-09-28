import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { form, FormField, required, email } from '@angular/forms/signals';
import { Auth as AuthService } from '../../../services/auth';
import { mensajeDeError } from '../../../shared/errores';

@Component({
  selector: 'app-login',
  imports: [FormField, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Se conserva al pasar a /registro (por ejemplo, desde una compra)
  volverA = this.route.snapshot.queryParamMap.get('volverA');

  modelo = signal({ email: '', password: '' });

  f = form(this.modelo, (s) => {
    required(s.email, { message: 'Ingresá tu mail' });
    email(s.email, { message: 'El mail no es válido' });
    required(s.password, { message: 'Ingresá tu contraseña' });
  });

  error = signal('');
  cargando = signal(false);

  async enviar(event: Event) {
    event.preventDefault();
    if (this.f().invalid()) return;

    this.cargando.set(true);
    this.error.set('');
    try {
      const m = this.modelo();
      await this.auth.login(m.email, m.password);
      const volverA = this.route.snapshot.queryParamMap.get('volverA');
      const destino = volverA && volverA.startsWith('/') && !volverA.startsWith('//')
        ? volverA
        : this.auth.rutaInicial();
      this.router.navigateByUrl(destino);
    } catch (e) {
      // El servicio ya arma un mensaje claro según qué falló (credenciales, conexión, perfil...)
      this.error.set(mensajeDeError(e, 'No se pudo iniciar sesión. Probá de nuevo.'));
    } finally {
      this.cargando.set(false);
    }
  }
}