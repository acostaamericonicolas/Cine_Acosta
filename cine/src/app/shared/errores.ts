/**
 * Texto para mostrarle al usuario a partir de un error.
 * Sirve para los errores de Supabase (PostgrestError), los que lanza la base con
 * "raise exception" (el message ya viene claro) y los Error propios de los servicios.
 * Si el error no trae mensaje, se muestra el texto por defecto.
 */
export function mensajeDeError(e: unknown, defecto = 'Ocurrió un error. Probá de nuevo.'): string {
    const mensaje = (e as { message?: unknown } | null)?.message;
    return typeof mensaje === 'string' && mensaje.trim() !== '' ? mensaje : defecto;
}
