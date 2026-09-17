import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase';
import { User } from '@supabase/supabase-js';

export interface RegistroUsuario {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  fechaNacimiento: string;
  tipoSangre?: string;
  colorOjos?: string;
  diasVacaciones?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  currentUser = signal<User | null>(null);

  constructor(private supabaseService: SupabaseService) {
    this.supabaseService.client.auth.onAuthStateChange((_event, session) => {
      this.currentUser.set(session?.user ?? null);
    });
  }

  async registrarUsuario(datos: RegistroUsuario) {
    const { 
      email, 
      password, 
      nombre, 
      apellido, 
      fechaNacimiento, 
      tipoSangre, 
      colorOjos, 
      diasVacaciones 
    } = datos;

    // Enviar metadatos completos para que el Trigger de Postgres arme el perfil en 'perfiles'
    const { data, error } = await this.supabaseService.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          nombre,
          apellido,
          fecha_nacimiento: fechaNacimiento,
          tipo_sangre: tipoSangre || 'O+',
          color_ojos: colorOjos || '',
          dias_vacaciones: diasVacaciones || 14,
          rol: 'cliente'
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

    // Consulta directa y limpia a la tabla unificada 'perfiles'
    const { data: perfil, error } = await this.supabaseService.client
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error al obtener el perfil unificado:', error);
      return null;
    }

    return perfil;
  }
}