import { Service, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGEN_BYTES = 2 * 1024 * 1024; // 2 MB

const EXTENSIONES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

@Service()
export class ImagenesService {
    private supabase = inject(SupabaseService).client;

    async subir(bucket: string, archivo: File): Promise<{ path: string; url: string }> {
        const ext = EXTENSIONES[archivo.type];
        if (!ext) throw new Error('Formato no permitido. Usá JPG, PNG o WebP.');

        const path = `${crypto.randomUUID()}.${ext}`;
        const { error } = await this.supabase.storage.from(bucket).upload(path, archivo, { contentType: archivo.type });
        if (error) throw error;

        const { data } = this.supabase.storage.from(bucket).getPublicUrl(path);
        return { path, url: data.publicUrl };
    }

    async eliminar(bucket: string, path: string) {
        const { error } = await this.supabase.storage.from(bucket).remove([path]);
        if (error) throw error;
    }
}