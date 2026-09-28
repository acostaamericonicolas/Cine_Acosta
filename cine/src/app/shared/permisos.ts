/**
 * Si una policy RLS no deja hacer un update o un delete, Supabase NO devuelve error:
 * simplemente no toca ninguna fila. Por eso los servicios terminan esas operaciones
 * en .select() y llaman a esta función con lo que volvió (ver README 4.2).
 */
export function verificarPermiso(filas: unknown[] | null, mensaje = 'No tenés permiso para hacer este cambio') {
    if (!filas || filas.length === 0) throw new Error(mensaje);
}
