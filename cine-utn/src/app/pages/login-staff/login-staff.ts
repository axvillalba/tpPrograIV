import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-login-staff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login-staff.html',
  styleUrl: './login-staff.css'
})
export class LoginStaffComponent {
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  email = signal<string>('');
  password = signal<string>('');
  cargando = signal<boolean>(false);
  errorMensaje = signal<string | null>(null);

  async iniciarSesionStaff() {
    this.cargando.set(true);
    this.errorMensaje.set(null);

    const emailLimpio = this.email().trim().toLowerCase();
    const pass = this.password();

    // --- BYPASS DE DESARROLLO TEMPORAL ---
    if (emailLimpio === 'gerente@cineutn.com' && pass === '123456') {
      this.cargando.set(false);
      this.router.navigate(['/admin/dashboard']);
      return;
    }

    try {
      // 1. Iniciar sesión en Supabase Auth
      const { data, error } = await this.supabaseService.client.auth.signInWithPassword({
        email: emailLimpio,
        password: pass
      });

      if (error || !data.user) {
        throw new Error('Credenciales inválidas. Verifique su correo y contraseña.');
      }

      // 2. Consultar perfil
      const { data: perfiles, error: errorPerfil } = await this.supabaseService.client
        .from('perfiles')
        .select('rol')
        .eq('id', data.user.id);

      if (errorPerfil) {
        console.error('Error al consultar perfil:', errorPerfil);
        throw new Error('Error al conectar con la tabla de perfiles.');
      }

      if (!perfiles || perfiles.length === 0) {
        throw new Error('No se encontró información de perfil para esta cuenta.');
      }

      const perfil = perfiles[0];

      // 3. Redirección según el rol
      if (perfil.rol === 'gerente') {
        this.router.navigate(['/admin/dashboard']);
      } else if (perfil.rol === 'empleado') {
        this.router.navigate(['/empleado/validador']);
      } else {
        await this.supabaseService.client.auth.signOut();
        throw new Error('Acceso denegado: Esta cuenta no posee permisos de personal corporativo.');
      }

    } catch (err: any) {
      this.errorMensaje.set(err.message || 'Ocurrió un error al intentar ingresar.');
    } finally {
      this.cargando.set(false);
    }
  }

  volverAlLoginCliente() {
    this.router.navigate(['/login']);
  }
}