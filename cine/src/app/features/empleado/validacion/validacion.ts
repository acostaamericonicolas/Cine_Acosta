import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { FuncionesService } from '../../../core/funciones.service';
import { ValidacionService } from '../../../core/validacion.service';
import { DatosValidacion, FuncionDelDia, ModoValidacion } from '../../../models/validacion';

interface Resultado {
  ok: boolean;
  modo: ModoValidacion;
  codigo: string;
  hora: Date;
  mensaje: string;
  datos: DatosValidacion | null;
}

/**
 * HU-32 y HU-33: el empleado valida la entrada o entrega el candy con el código.
 * El campo de texto sirve para tipear el código y para los lectores de QR USB,
 * que "escriben" el código y mandan Enter como un teclado.
 */
@Component({
  selector: 'app-validacion',
  imports: [DatePipe, FormField],
  styleUrl: './validacion.css',
  templateUrl: './validacion.html',
})
export class Validacion {
  private validacion = inject(ValidacionService);
  private funciones = inject(FuncionesService);

  private campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  modo = signal<ModoValidacion>('entrada');
  funcionesDeHoy = signal<FuncionDelDia[]>([]);
  funcionElegida = signal('');   // '' = cualquier función

  modelo = signal({ codigo: '' });
  f = form(this.modelo, (s) => {
    required(s.codigo, { message: 'Escaneá o escribí el código' });
  });

  procesando = signal(false);
  ultimo = signal<Resultado | null>(null);
  historial = signal<Resultado[]>([]);   // últimos 10, para el control del empleado

  constructor() {
    this.funciones.listarDeHoy()
      .then(lista => this.funcionesDeHoy.set(lista))
      .catch(() => { /* sin la lista se valida igual, sin controlar la función */ });
  }

  cambiarModo(modo: ModoValidacion) {
    this.modo.set(modo);
    this.ultimo.set(null);
    this.enfocar();
  }

  async enviar(event: Event) {
    event.preventDefault();
    const codigo = this.modelo().codigo.trim().toUpperCase();
    if (!codigo || this.procesando()) return;

    this.procesando.set(true);
    const modo = this.modo();
    let resultado: Resultado;
    try {
      const datos = modo === 'entrada'
        ? await this.validacion.validarEntrada(codigo, this.funcionElegida() ? Number(this.funcionElegida()) : null)
        : await this.validacion.entregarCandy(codigo);
      resultado = {
        ok: true, modo, codigo, hora: new Date(), datos,
        mensaje: modo === 'entrada' ? 'Entrada válida: puede ingresar.' : 'Candy listo para entregar.',
      };
    } catch (e) {
      // El mensaje viene de la base: inexistente, cancelada, ya usada, otra función...
      resultado = { ok: false, modo, codigo, hora: new Date(), datos: null, mensaje: (e as Error).message };
    } finally {
      this.procesando.set(false);
    }

    this.ultimo.set(resultado);
    this.historial.update(h => [resultado, ...h].slice(0, 10));

    // Listo para el siguiente: campo vacío y con el foco (el lector escanea sin tocar nada)
    this.modelo.set({ codigo: '' });
    this.f().reset();
    this.enfocar();
  }

  private enfocar() {
    setTimeout(() => this.campo()?.nativeElement.focus());
  }
}
