import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase';
import { User } from '@supabase/supabase-js';

export interface RegistroUsuario {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  tipoSangre: string;
  colorOjos: string;
  diasVacaciones: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser = signal<User | null>(null);

  constructor(private supabaseService: SupabaseService) {
    this.supabaseService.client.auth.onAuthStateChange((event, session) => {
      this.currentUser.set(session?.user ?? null);
    });
  }

  async registrarUsuario(datos: RegistroUsuario) {
    const { email, password, nombre, apellido, fechaNacimiento, tipoSangre, colorOjos, diasVacaciones } = datos;

    const { data, error } = await this.supabaseService.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellido,
          fecha_nacimiento: fechaNacimiento,
          tipo_sangre: tipoSangre,
          color_ojos: colorOjos,
          dias_vacaciones: diasVacaciones
        }
      }
    });

    if (error) throw error;
    return data;
  }

  async login(email: string, password: string) {
    const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  }

  async logout() {
    const { error } = await this.supabaseService.client.auth.signOut();
    if (error) throw error;
  }

async getPerfilActual() {
  const { data: { user } } = await this.supabaseService.client.auth.getUser();
  if (!user) return null;

  // 1. Probar en la tabla del personal (perfiles)
  const { data: perfilStaff } = await this.supabaseService.client
    .from('perfiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (perfilStaff) return perfilStaff;

  // 2. Si no está en perfiles, probar en profiles
  const { data: perfilCliente } = await this.supabaseService.client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return perfilCliente;
}
}