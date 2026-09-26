import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { form, FormField, required, email, pattern } from '@angular/forms/signals';
import { ComprasService } from '../../../core/compras.service';

/**
 * "Buscar mi compra": el invitado no tiene cuenta ni recibe mails,
 * así que recupera su comprobante con el código y el mail de la compra.
 */
@Component({
  selector: 'app-buscar-compra',
  imports: [FormField],
  templateUrl: './buscar-compra.html',
  styleUrl: './buscar-compra.css',
})
export class BuscarCompra {
  private router = inject(Router);
  private compras = inject(ComprasService);

  modelo = signal({ codigo: '', email: '' });
  f = form(this.modelo, (s) => {
    required(s.codigo, { message: 'Ingresá el código de compra' });
    pattern(s.codigo, /^\s*[A-Za-z0-9]{10}\s*$/, { message: 'El código tiene 10 letras y números' });
    required(s.email, { message: 'Ingresá el mail con el que compraste' });
    email(s.email, { message: 'El mail no es válido' });
  });

  buscar(event: Event) {
    event.preventDefault();
    if (this.f().invalid()) return;
    const codigo = this.modelo().codigo.trim().toUpperCase();
    // El comprobante valida código + mail en la base; si no coinciden, lo avisa ahí
    this.compras.recordarMail(codigo, this.modelo().email.trim());
    this.router.navigate(['/comprobante', codigo]);
  }
}
