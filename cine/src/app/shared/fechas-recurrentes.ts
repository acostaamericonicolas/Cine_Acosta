export const DIAS_SEMANA = [
    { valor: 1, texto: 'Lunes' },
    { valor: 2, texto: 'Martes' },
    { valor: 3, texto: 'Miércoles' },
    { valor: 4, texto: 'Jueves' },
    { valor: 5, texto: 'Viernes' },
    { valor: 6, texto: 'Sábado' },
    { valor: 0, texto: 'Domingo' },
];

/**
 * Devuelve un ISO string (en UTC) por cada fecha entre desde y hasta (ambas
 * inclusive) cuyo día de la semana esté en diasElegidos, a la hora indicada.
 * fecha: 'AAAA-MM-DD', hora: 'HH:mm'. Se arman en horario local y se convierten a UTC.
 */
export function generarFechas(
    desde: string, hasta: string, diasElegidos: number[], hora: string
): string[] {
    const resultado: string[] = [];
    const fin = new Date(`${hasta}T00:00`);
    const actual = new Date(`${desde}T00:00`);

    while (actual <= fin) {
        if (diasElegidos.includes(actual.getDay())) {
            const [h, m] = hora.split(':').map(Number);
            const conHora = new Date(actual);
            conHora.setHours(h, m, 0, 0);
            resultado.push(conHora.toISOString());
        }
        actual.setDate(actual.getDate() + 1);
    }
    return resultado;
}