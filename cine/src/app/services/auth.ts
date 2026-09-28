import { Service, computed, inject, signal } from '@angular/core';
import { AuthError } from '@supabase/supabase-js';
import { Supabase as SupabaseService } from './supabase';
import { DatosRegistro, Perfil } from '../models/perfil';

/**
 * A4: traduce los errores de Supabase Auth a un mensaje claro para el usuario.
 * Se distingue por el código del error; sin conexión, supabase-js no trae código.
 */
export function mensajeDeAuth(error: AuthError): string {
    if (!navigator.onLine || error.name === 'AuthRetryableFetchError' || error.status === 0) {
        return 'No hay conexión con el servidor. Revisá tu internet y probá de nuevo.';
    }
    switch (error.code) {
        case 'invalid_credentials':
            return 'El mail o la contraseña no son correctos.';
        case 'email_not_confirmed':
            return 'Todavía no confirmaste tu mail. Revisá tu casilla antes de ingresar.';
        case 'user_banned':
            return 'Esta cuenta está bloqueada. Comunicate con el cine.';
        case 'user_already_exists':
        case 'email_exists':
            return 'Ya existe una cuenta con ese mail. Ingresá con tu contraseña o usá otro mail.';
        case 'weak_password':
            return 'La contraseña es muy débil. Usá al menos 6 caracteres, mezclando letras y números.';
        case 'email_address_invalid':
            return 'El mail no es válido.';
        case 'over_request_rate_limit':
        case 'over_email_send_rate_limit':
            return 'Hubo demasiados intentos seguidos. Esperá unos minutos y probá de nuevo.';
        default:
            return 'No se pudo completar la operación. Probá de nuevo en unos minutos.';
    }
}

@Service()
export class Auth {
    private supabase = inject(SupabaseService).client;

    readonly perfil = signal<Perfil | null>(null);
    readonly listo = signal(false); // true cuando ya se intentó restaurar la sesión
    readonly logueado = computed(() => this.perfil() !== null);
    readonly rol = computed(() => this.perfil()?.rol ?? null);

    // Promesa que se resuelve cuando ya se intentó restaurar la sesión (la usan los guards)
    readonly inicializada = this.restaurarSesion();

    private async restaurarSesion() {
        try {
            const { data } = await this.supabase.auth.getSession();
            if (data.session) await this.cargarPerfil(data.session.user.id);
        } catch (e) {
            console.error('No se pudo restaurar la sesión', e);
        } finally {
            this.listo.set(true);
        }
    }

    private async cargarPerfil(id: string) {
        const { data, error } = await this.supabase
            .from('perfiles')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        this.perfil.set(data as Perfil);
    }

    async registrar(d: DatosRegistro) {
        const { data, error } = await this.supabase.auth.signUp({
            email: d.email,
            password: d.password,
        });
        if (error) throw new Error(mensajeDeAuth(error));
        if (!data.user || !data.session) {
            throw new Error('Supabase está pidiendo confirmar el mail. Desactivá esa opción en Authentication.');
        }

        const { error: errPerfil } = await this.supabase.from('perfiles').insert({
            id: data.user.id,
            email: d.email,
            nombre: d.nombre,
            apellido: d.apellido,
            fecha_nacimiento: d.fechaNacimiento,
            tipo_sangre: d.tipoSangre,
            color_ojos: d.colorOjos,
            dias_vacaciones: d.diasVacaciones,
        });
        if (errPerfil) throw errPerfil;

        await this.cargarPerfil(data.user.id);
    }

    async login(email: string, password: string) {
        const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(mensajeDeAuth(error));

        // La cuenta existe pero hay que poder leer su perfil (rol, puntos, crédito)
        try {
            await this.cargarPerfil(data.user.id);
        } catch (e) {
            await this.supabase.auth.signOut();   // no queda una sesión a medias
            const sinPerfil = (e as { code?: string }).code === 'PGRST116';   // .single() sin filas
            throw new Error(sinPerfil
                ? 'Tu cuenta existe pero su registro quedó incompleto (falta el perfil). Comunicate con el cine para revisarla.'
                : 'Ingresaste, pero no pudimos cargar tus datos. Revisá tu conexión y probá de nuevo.');
        }
    }

    async logout() {
        await this.supabase.auth.signOut();
        this.perfil.set(null);
    }

    // Vuelve a leer el perfil (crédito y puntos cambian con las compras)
    async refrescarPerfil() {
        const id = this.perfil()?.id;
        if (id) await this.cargarPerfil(id);
    }

    rutaInicial(): string {
        switch (this.rol()) {
            case 'admin': return '/admin';
            case 'empleado': return '/empleado';
            default: return '/';
        }
    }
}