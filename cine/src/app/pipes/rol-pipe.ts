import { Pipe, PipeTransform } from '@angular/core';
import { Rol } from '../models/perfil';

const TEXTO_ROL: Record<Rol, string> = {
    cliente: 'Cliente',
    empleado: 'Empleado',
    admin: 'Administrador',
};

/**
 * Rol de un usuario: 'admin' → "Administrador", 'empleado' → "Empleado".
 * Uso: {{ perfil.rol | rol }}
 */
@Pipe({ name: 'rol' })
export class RolPipe implements PipeTransform {
    transform(valor: Rol | null | undefined): string {
        return valor ? TEXTO_ROL[valor] : '';
    }
}
