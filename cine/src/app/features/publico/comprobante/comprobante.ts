import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { form, FormField, required, email } from '@angular/forms/signals';
import { AuthService } from '../../../core/auth.service';
import { ComprasService } from '../../../core/compras.service';
import { Comprobante as DatosComprobante } from '../../../models/compra';
import { CodigoQr } from '../../../shared/componentes/codigo-qr/codigo-qr';
import { DuracionPipe } from '../../../shared/pipes/duracion-pipe';
import { TEXTO_TIPO } from '../../../shared/sala-layout';

/**
 * HU-27: comprobante imprimible con el código y su QR.
 * "Guardar como PDF" usa la impresión del navegador (window.print), sin librerías de PDF.
 */
@Component({
  selector: 'app-comprobante',
  imports: [DatePipe, DecimalPipe, RouterLink, FormField, CodigoQr, DuracionPipe],
  templateUrl: './comprobante.html',
  styleUrl: './comprobante.css',
})
export class Comprobante {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  private compras = inject(ComprasService);

  readonly textoTipo = TEXTO_TIPO;
  readonly codigo = (this.route.snapshot.paramMap.get('codigo') ?? '').toUpperCase();

  comprobante = signal<DatosComprobante | null>(null);
  cargando = signal(true);
  error = signal('');
  pedirMail = signal(false);   // invitado sin el mail recordado: se lo pide

  modeloMail = signal({ email: '' });
  fMail = form(this.modeloMail, (s) => {
    required(s.email, { message: 'Ingresá el mail con el que compraste' });
    email(s.email, { message: 'El mail no es válido' });
  });

  candyPendiente = computed(() => this.comprobante()?.items.some(i => !i.entregado_en) ?? false);

  constructor() {
    this.iniciar();
  }

  private async iniciar() {
    await this.auth.inicializada;
    await this.buscar(this.compras.mailRecordado(this.codigo));
  }

  private async buscar(mail: string | null) {
    this.cargando.set(true);
    this.error.set('');
    try {
      this.comprobante.set(await this.compras.obtenerComprobante(this.codigo, mail));
      this.pedirMail.set(false);
      if (mail) this.compras.recordarMail(this.codigo, mail);
    } catch (e) {
      // Sin sesión y sin mail todavía no es un error: falta pedirlo
      if (!this.auth.logueado() && mail === null) {
        this.pedirMail.set(true);
      } else {
        this.error.set((e as Error).message);
        this.pedirMail.set(!this.auth.logueado());
      }
    } finally {
      this.cargando.set(false);
    }
  }

  enviarMail(event: Event) {
    event.preventDefault();
    if (this.fMail().invalid()) return;
    this.buscar(this.modeloMail().email.trim());
  }

  imprimir() {
    window.print();
  }
}
