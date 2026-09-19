import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export type Rol = 'cliente' | 'empleado' | 'admin';

export interface Perfil {
    id: string;
    email: string;
    nombre: string;
    apellido: string;
    fecha_nacimiento: string;
    tipo_sangre: string;
    color_ojos: string;
    dias_vacaciones: number;
    rol: Rol;
    credito: number;
    puntos: number;
}

export interface DatosRegistro {
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    fechaNacimiento: string;
    tipoSangre: string;
    colorOjos: string;
    diasVacaciones: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
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
        if (error) throw error;
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
        if (error) throw error;
        await this.cargarPerfil(data.user.id);
    }

    async logout() {
        await this.supabase.auth.signOut();
        this.perfil.set(null);
    }

    rutaInicial(): string {
        switch (this.rol()) {
            case 'admin': return '/admin';
            case 'empleado': return '/empleado';
            default: return '/';
        }
    }
}