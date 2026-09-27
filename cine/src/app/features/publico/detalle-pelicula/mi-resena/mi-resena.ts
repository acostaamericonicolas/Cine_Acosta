import { Component, effect, inject, input, output, signal } from '@angular/core';
import { form, FormField, maxLength, validate } from '@angular/forms/signals';
import { AuthService } from '../../../../core/auth.service';
import { ResenasService } from '../../../../core/resenas.service';
import { Resena } from '../../../../models/resena';
import { EstrellasPipe } from '../../../../shared/pipes/estrellas-pipe';

export const MAX_COMENTARIO = 200;

/**
 * HU-10: calificación con 1 a 5 estrellas y un comentario corto.
 * Solo quien compró una entrada, después de que terminó su función, y una sola vez:
 * una vez publicada no se edita. La regla la decide la base (puede_resenar).
 */
@Component({
  selector: 'app-mi-resena',
  imports: [FormField, EstrellasPipe],
  templateUrl: './mi-resena.html',
  styleUrl: './mi-resena.css',
})
export class MiResena {
  private auth = inject(AuthService);
  private service = inject(ResenasService);

  peliculaId = input.required<number>();
  cambio = output<void>();   // avisa al detalle para que recargue la lista y el promedio

  readonly max = MAX_COMENTARIO;
  readonly opciones = [1, 2, 3, 4, 5];

  cargando = signal(true);
  existente = signal<Resena | null>(null);
  puede = signal(false);
  motivo = signal('');       // por qué todavía no puede calificar
  guardando = signal(false);
  error = signal('');
  resaltada = signal(0);     // estrella bajo el mouse

  modelo = signal({ estrellas: 0, comentario: '' });
  f = form(this.modelo, (s) => {
    validate(s.estrellas, ({ value }) =>
      value() < 1 || value() > 5 ? { kind: 'estrellas', message: 'Elegí de 1 a 5 estrellas' } : null
    );
    maxLength(s.comentario, MAX_COMENTARIO, { message: `Máximo ${MAX_COMENTARIO} caracteres` });
  });

  constructor() {
    effect(() => {
      const id = this.peliculaId();
      const perfil = this.auth.perfil();
      if (perfil?.rol === 'cliente') this.cargar(id, perfil.id);
    });
  }

  private async cargar(peliculaId: number, usuarioId: string) {
    this.cargando.set(true);
    try {
      const [mia, permiso] = await Promise.all([
        this.service.miResena(peliculaId, usuarioId),
        this.service.puedeResenar(peliculaId),
      ]);
      this.existente.set(mia);
      this.puede.set(permiso.puede);
      this.motivo.set(permiso.motivo ?? '');
    } catch {
      this.puede.set(false);
      this.motivo.set('');
    } finally {
      this.cargando.set(false);
    }
  }

  elegir(n: number) {
    this.modelo.update(m => ({ ...m, estrellas: n }));
  }

  async publicar(event: Event) {
    event.preventDefault();
    if (this.f().invalid() || this.guardando()) return;
    if (!confirm('La calificación es una sola vez: una vez publicada no se puede cambiar. ¿Publicar?')) return;

    this.guardando.set(true);
    this.error.set('');
    try {
      const m = this.modelo();
      await this.service.publicar(this.peliculaId(), m.estrellas, m.comentario.trim());
      await this.cargar(this.peliculaId(), this.auth.perfil()!.id);
      this.cambio.emit();
    } catch (e) {
      this.error.set((e as Error).message);
    } finally {
      this.guardando.set(false);
    }
  }
}
