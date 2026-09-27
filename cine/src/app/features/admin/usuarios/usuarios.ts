import { Component, inject, signal } from '@angular/core';
import { form, FormField, required, email, minLength, validate } from '@angular/forms/signals';
import { ConCambios } from '../../../core/guards/form-guard';
import { PersonalService } from '../../../core/personal.service';
import { DatosAltaPersonal, Perfil } from '../../../models/perfil';
import { fechaLocal } from '../../../shared/fechas';

const VACIO: DatosAltaPersonal = { email: '', password: '', nombre: '', apellido: '', fechaNacimiento: '', rol: 'empleado' };

/**
 * HU-34 (con el cambio pedido): el admin da de ALTA cuentas nuevas de personal,
 * empleado u otro admin. No convierte clientes: si el mail ya existe, la base lo rechaza.
 */
@Component({
  selector: 'app-usuarios',
  imports: [FormField],
  styleUrl: './usuarios.css',
  templateUrl: './usuarios.html',
})
export class Usuarios implements ConCambios {
  private service = inject(PersonalService);
  private hoy = fechaLocal();

  readonly roles = [
    { valor: 'empleado', texto: 'Empleado (valida entradas y entrega candy)' },
    { valor: 'admin', texto: 'Administrador (control total)' },
  ];

  personal = signal<Perfil[]>([]);
  cargando = signal(true);
  error = signal('');
  mensaje = signal('');
  guardando = signal(false);

  modelo = signal<DatosAltaPersonal>({ ...VACIO });
  f = form(this.modelo, (s) => {
    required(s.nombre, { message: 'Ingresá el nombre' });
    required(s.apellido, { message: 'Ingresá el apellido' });
    required(s.email, { message: 'Ingresá el mail' });
    email(s.email, { message: 'El mail no es válido' });
    required(s.password, { message: 'Ingresá una contraseña inicial' });
    minLength(s.password, 6, { message: 'Mínimo 6 caracteres' });
    required(s.fechaNacimiento, { message: 'Ingresá la fecha de nacimiento' });
    validate(s.fechaNacimiento, ({ value }) =>
      value() > this.hoy ? { kind: 'fecha-futura', message: 'La fecha no puede ser futura' } : null
    );
  });

  constructor() {
    this.cargar();
  }

  // Lo consulta formGuard antes de salir con un alta a medio cargar
  hayCambios(): boolean {
    return JSON.stringify(this.modelo()) !== JSON.stringify(VACIO);
  }

  private async cargar() {
    try {
      this.personal.set(await this.service.listar());
    } catch (e) {
      this.error.set((e as { message?: string }).message ?? 'No se pudo cargar el personal');
    } finally {
      this.cargando.set(false);
    }
  }

  async darDeAlta(event: Event) {
    event.preventDefault();
    if (this.f().invalid() || this.guardando()) return;

    this.error.set('');
    this.mensaje.set('');
    this.guardando.set(true);
    try {
      const d = this.modelo();
      await this.service.alta(d);
      this.mensaje.set(`Se creó la cuenta de ${d.nombre} ${d.apellido} (${d.rol === 'admin' ? 'administrador' : 'empleado'}). `
        + `Ya puede ingresar con ${d.email.trim()} y la contraseña inicial.`);
      this.modelo.set({ ...VACIO });
      this.f().reset();
      this.personal.set(await this.service.listar());
    } catch (e) {
      this.error.set((e as Error).message);   // por ejemplo: el mail ya pertenece a un cliente
    } finally {
      this.guardando.set(false);
    }
  }
}
