import { Service, inject } from '@angular/core';
import { Supabase as SupabaseService } from './supabase';
import { DatosAltaPersonal, Perfil } from '../models/perfil';

/**
 * Personal del cine (HU-34): el admin da de alta empleados u otros admins.
 * Nunca convierte cuentas existentes: si el mail ya tiene perfil, la base lo rechaza.
 */
@Service()
export class Personal {
    private supabaseService = inject(SupabaseService);
    private supabase = this.supabaseService.client;

    // Empleados y admins (la policy "admin ve todos" deja leer los perfiles)
    async listar(): Promise<Perfil[]> {
        const { data, error } = await this.supabase
            .from('perfiles')
            .select('*')
            .in('rol', ['empleado', 'admin'])
            .order('rol')
            .order('apellido');
        if (error) throw error;
        return data as Perfil[];
    }

    async alta(d: DatosAltaPersonal) {
        // 1) Cuenta de Auth, con un cliente sin sesión: la sesión del admin no se toca
        const aparte = this.supabaseService.crearClienteSinSesion();
        const { error: errAuth } = await aparte.auth.signUp({ email: d.email.trim(), password: d.password });
        if (errAuth) {
            // Si el mail ya existe, se sigue: alta_personal dice si es un cliente (y lo rechaza)
            // o si es una cuenta que quedó sin perfil por un alta anterior que falló a mitad
            const yaExiste = /already|registered|exists/i.test(errAuth.message);
            if (!yaExiste) throw new Error(`No se pudo crear la cuenta: ${errAuth.message}`);
        }
        await aparte.auth.signOut().catch(() => { });

        // 2) Perfil con el rol, con la sesión del admin (la función controla que sea admin)
        const { error } = await this.supabase.rpc('alta_personal', {
            p_email: d.email,
            p_nombre: d.nombre,
            p_apellido: d.apellido,
            p_fecha_nacimiento: d.fechaNacimiento,
            p_rol: d.rol,
        });
        if (error) throw new Error(error.message);
    }
}
