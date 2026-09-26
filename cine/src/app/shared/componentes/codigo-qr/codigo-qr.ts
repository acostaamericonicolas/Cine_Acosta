import { Component, effect, input, signal } from '@angular/core';
import { toDataURL } from 'qrcode';

/**
 * QR del código de compra (HU-27). El QR contiene solo el código:
 * el lector de la puerta lo "escribe" en el campo de validación (HU-32).
 */
@Component({
  selector: 'app-codigo-qr',
  templateUrl: './codigo-qr.html',
  styleUrl: './codigo-qr.css',
})
export class CodigoQr {
  codigo = input.required<string>();
  tamanio = input(200);

  imagen = signal<string | null>(null);

  constructor() {
    // Se regenera si cambia el código (toDataURL es asíncrono)
    effect(() => {
      const codigo = this.codigo();
      toDataURL(codigo, { width: this.tamanio(), margin: 1, errorCorrectionLevel: 'M' })
        .then(url => this.imagen.set(url))
        .catch(() => this.imagen.set(null));   // sin QR, el código impreso alcanza para validar
    });
  }
}
