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

// Alta de personal por el admin (HU-34): solo empleado u otro admin
export type RolPersonal = 'empleado' | 'admin';

export interface DatosAltaPersonal {
    email: string;
    password: string;
    nombre: string;
    apellido: string;
    fechaNacimiento: string;
    rol: RolPersonal;
}
