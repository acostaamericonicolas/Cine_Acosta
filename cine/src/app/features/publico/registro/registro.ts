import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { form, FormField, required, email, minLength, min, max } from '@angular/forms/signals';
import { Auth as AuthService } from '../../../services/auth';
import { DatosRegistro } from '../../../models/perfil';
import { ConCambios } from '../../../guards/form-guard';
import { mensajeDeError } from '../../../shared/errores';
import { fechaNoFutura } from '../../../validators/validators';

@Component({
  selector: 'app-registro',
  imports: [FormField, RouterLink],
  templateUrl: './registro.html',
  styleUrl: './registro.css',
})
export class Registro implements ConCambios {
  private auth = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Si viene de una compra, vuelve a ella después de registrarse (solo rutas internas)
  private volverA = this.route.snapshot.queryParamMap.get('volverA');
  destino = this.volverA && this.volverA.startsWith('/') && !this.volverA.startsWith('//') ? this.volverA : null;
  private guardado = false;

  hayCambios(): boolean {
    return this.f().dirty() && !this.guardado;
  }

  tiposSangre = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-', 'Prefiero no responder'];
  coloresOjos = ['Marrón', 'Negro', 'Azul', 'Verde', 'Gris', 'Miel', 'Prefiero no responder'];

  modelo = signal<DatosRegistro>({
    email: '',
    password: '',
    nombre: '',
    apellido: '',
    fechaNacimiento: '',
    tipoSangre: '',
    colorOjos: '',
    diasVacaciones: 0,
  });

  f = form(this.modelo, (s) => {
    required(s.email, { message: 'Ingresá tu mail' });
    email(s.email, { message: 'El mail no es válido' });
    required(s.password, { message: 'Ingresá una contraseña' });
    minLength(s.password, 6, { message: 'Mínimo 6 caracteres' });
    required(s.nombre, { message: 'Ingresá tu nombre' });
    required(s.apellido, { message: 'Ingresá tu apellido' });
    required(s.fechaNacimiento, { message: 'Ingresá tu fecha de nacimiento' });
    fechaNoFutura(s.fechaNacimiento);
    required(s.tipoSangre, { message: 'Elegí tu tipo de sangre' });
    required(s.colorOjos, { message: 'Elegí el color de ojos' });
    min(s.diasVacaciones, 0, { message: 'No puede ser negativo' });
    max(s.diasVacaciones, 365, { message: 'Máximo 365 días' });
  });

  error = signal('');
  cargando = signal(false);

  async enviar(event: Event) {
    event.preventDefault();
    if (this.f().invalid()) return;

    this.cargando.set(true);
    this.error.set('');
    try {
      await this.auth.registrar(this.modelo());
      this.guardado = true;
      this.router.navigateByUrl(this.destino ?? '/');
    } catch (e) {
      this.error.set(mensajeDeError(e, 'No se pudo completar el registro'));
    } finally {
      this.cargando.set(false);
    }
  }
}