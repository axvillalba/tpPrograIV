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

    // Trae el perfil junto con los datos y permisos del rol configurable si tiene uno asignado
    const { data: perfil, error } = await this.supabaseService.client
      .from('perfiles')
      .select('*, roles_admin(id, nombre, descripcion, permisos)')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error al obtener el perfil unificado:', error);
      return null;
    }

    return perfil;
  }

  /**
   * Verifica si el perfil tiene acceso administrativo general o a una pestaña específica.
   */
  tienePermisoAdmin(perfil: any, seccion?: string): boolean {
    if (!perfil) return false;

    // Superadmin: gerente o admin sin restricción de rol granular
    const esSuperAdmin = (perfil.rol === 'gerente' || perfil.rol === 'admin') && !perfil.rol_admin_id;
    if (esSuperAdmin) return true;

    // Usuario con rol personalizado asignado
    const permisos: string[] = perfil.roles_admin?.permisos || [];
    if (!seccion) {
      return permisos.length > 0;
    }

    return permisos.includes(seccion);
  }

  calcularEdad(fechaNacimientoStr: string | Date): number {
    if (!fechaNacimientoStr) return 0;

    const hoy = new Date();
    const fechaNac = new Date(fechaNacimientoStr);
    let edad = hoy.getFullYear() - fechaNac.getFullYear();
    const mes = hoy.getMonth() - fechaNac.getMonth();

    if (mes < 0 || (mes === 0 && hoy.getDate() < fechaNac.getDate())) {
      edad--;
    }

    return edad;
  }
}