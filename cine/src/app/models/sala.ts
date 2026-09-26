import { TipoButaca } from '../shared/sala-layout';

export interface Sala {
    id: number;
    nombre: string;
    activa: boolean;
}

export type Precios = Record<TipoButaca, number>;
