// 'AAAA-MM-DD' en horario local. toISOString() la daría en UTC:
// en Argentina, después de las 21 h ya devolvería el día siguiente.
export function fechaLocal(d: Date = new Date()): string {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}