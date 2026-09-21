export type TipoButaca = 'general' | 'accesible' | 'vip';

export interface Butaca {
    id: string;      // 'J-10'
    fila: string;
    numero: number;
    tipo: TipoButaca;
}

export interface FilaSala {
    letra: string;
    bloques: (Butaca | null)[][];   // 3 bloques (4, 20 y 4); null = hueco, no hay butaca
}

export const TEXTO_TIPO: Record<TipoButaca, string> = {
    general: 'General',
    accesible: 'Accesible',
    vip: 'VIP',
};

// La fila K no existe: se quitó para hacer lugar a la fila accesible (J)
const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'];

const BLOQUES = [
    { desde: 1, hasta: 4 },
    { desde: 5, hasta: 24 },
    { desde: 25, hasta: 28 },
];

// Fila J: 2 + 10 + 2 butacas accesibles, el resto son huecos
const ACCESIBLES_J = new Set([2, 3, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 26, 27]);
const FILAS_VIP = ['R', 'S', 'T'];

function tipoDe(fila: string, numero: number): TipoButaca | null {
    if (fila === 'J') return ACCESIBLES_J.has(numero) ? 'accesible' : null;
    return FILAS_VIP.includes(fila) ? 'vip' : 'general';
}

export const SALA: FilaSala[] = LETRAS.map(letra => ({
    letra,
    bloques: BLOQUES.map(({ desde, hasta }) => {
        const slots: (Butaca | null)[] = [];
        for (let n = desde; n <= hasta; n++) {
            const tipo = tipoDe(letra, n);
            slots.push(tipo ? { id: `${letra}-${n}`, fila: letra, numero: n, tipo } : null);
        }
        return slots;
    }),
}));

// Lista plana con las 518 butacas que existen
export const BUTACAS: Butaca[] = SALA
    .flatMap(f => f.bloques.flat())
    .filter((b): b is Butaca => b !== null);