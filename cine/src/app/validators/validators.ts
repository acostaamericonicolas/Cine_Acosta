import { PathKind, SchemaPath, SchemaPathRules, validate } from '@angular/forms/signals';
import { fechaLocal } from '../shared/fechas';

// Un campo de fecha 'AAAA-MM-DD' dentro del esquema de un Signal Form
type CampoFecha<K extends PathKind> = SchemaPath<string, SchemaPathRules.Supported, K>;

/**
 * La fecha no puede ser posterior a hoy (fecha de nacimiento).
 * Se compara con fechaLocal(): la fecha de hoy en horario local, no en UTC.
 * Uso dentro de form(): fechaNoFutura(s.fechaNacimiento);
 */
export function fechaNoFutura<K extends PathKind>(campo: CampoFecha<K>, message = 'La fecha no puede ser futura') {
    validate(campo, ({ value }) =>
        value() && value() > fechaLocal() ? { kind: 'fecha-futura', message } : null
    );
}

/**
 * En un rango, la fecha "hasta" no puede ser anterior a "desde".
 * Uso dentro de form(): fechaNoAnterior(s.hasta, s.desde);
 */
export function fechaNoAnterior<K extends PathKind>(
    hasta: CampoFecha<K>,
    desde: CampoFecha<K>,
    message = 'No puede ser anterior a la fecha de inicio',
) {
    validate(hasta, ({ value, valueOf }) =>
        value() && valueOf(desde) && value() < valueOf(desde) ? { kind: 'rango-invalido', message } : null
    );
}
