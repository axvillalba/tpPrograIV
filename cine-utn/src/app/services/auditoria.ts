import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';
import { AuthService } from './auth';

@Injectable({
  providedIn: 'root'
})
export class AuditoriaService {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  async registrarAccion(accion: string, detalle: any = {}) {
    try {
      const user = this.authService.currentUser();
      const perfil = await this.authService.getPerfilActual();

      await this.supabaseService.client.from('logs_auditoria').insert([{
        usuario_id: user?.id || null,
        usuario_email: user?.email || 'Sistema/Anónimo',
        accion: accion,
        detalle: detalle
      }]);
    } catch (err) {
      console.error('Error guardando log de auditoría:', err);
    }
  }

  async obtenerLogs() {
    return await this.supabaseService.client
      .from('logs_auditoria')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
  }
}