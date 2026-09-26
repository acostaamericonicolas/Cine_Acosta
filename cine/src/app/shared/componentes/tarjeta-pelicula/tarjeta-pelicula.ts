import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pelicula } from '../../../models/pelicula';
import { DuracionPipe } from '../../pipes/duracion-pipe';

@Component({
  selector: 'app-tarjeta-pelicula',
  imports: [RouterLink, DuracionPipe],
  templateUrl: './tarjeta-pelicula.html',
  styleUrl: './tarjeta-pelicula.css',
})
export class TarjetaPelicula {
  pelicula = input.required<Pelicula>();
}