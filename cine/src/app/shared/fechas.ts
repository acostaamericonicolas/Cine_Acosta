// 'AAAA-MM-DD' en horario local. toISOString() la daría en UTC:
// en Argentina, después de las 21 h ya devolvería el día siguiente.
export function fechaLocal(d: Date = new Date()): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

// Edad cumplida a hoy a partir de 'AAAA-MM-DD'. Se compara como texto
// para no pasar por Date (que la interpretaría en UTC).
export function edad(fechaNacimiento: string, hoy: string = fechaLocal()): number {
    const anios = Number(hoy.slice(0, 4)) - Number(fechaNacimiento.slice(0, 4));
    return hoy.slice(5) < fechaNacimiento.slice(5) ? anios - 1 : anios;
}

// Suma días a 'AAAA-MM-DD' y devuelve el mismo formato (en horario local)
export function sumarDias(fecha: string, dias: number): string {
    const [a, m, d] = fecha.split('-').map(Number);
    return fechaLocal(new Date(a, m - 1, d + dias));
}
