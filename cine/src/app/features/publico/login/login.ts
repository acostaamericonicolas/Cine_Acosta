import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { form, FormField, required, email } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormField, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(AuthService);
  private router = inject(Router);

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
      this.router.navigate([this.auth.rutaInicial()]);
    } catch {
      this.error.set('Mail o contraseña incorrectos');
    } finally {
      this.cargando.set(false);
    }
  }
}