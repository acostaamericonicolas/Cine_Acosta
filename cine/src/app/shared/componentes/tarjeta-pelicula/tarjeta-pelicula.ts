import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Pelicula } from '../../../core/peliculas.service';
import { DuracionPipe } from '../../pipes/duracion.pipe';

@Component({
  selector: 'app-tarjeta-pelicula',
  imports: [RouterLink, DuracionPipe],
  templateUrl: './tarjeta-pelicula.html',
  styleUrl: './tarjeta-pelicula.css',
})
export class TarjetaPelicula {
  @Input({ required: true }) pelicula!: Pelicula;
}