import { Service } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Service()
export class SupabaseService {
    readonly client = createClient(environment.supabaseUrl, environment.supabasePublishableKey);

    /**
     * Cliente aparte, sin sesión guardada, solo para que el admin cree cuentas de personal (HU-34).
     * Con el cliente principal, signUp reemplazaría la sesión del admin por la del usuario nuevo.
     * storageKey propio para no compartir el almacenamiento con el cliente principal.
     */
    crearClienteSinSesion(): SupabaseClient {
        return createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storageKey: 'cine-alta-personal',
            },
        });
    }
}
