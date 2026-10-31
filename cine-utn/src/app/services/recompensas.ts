import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase';

export interface Recompensa {
  id?: string;
  nombre: string;
  descripcion?: string | null;
  costo_puntos: number;
  tipo: string;
  imagen_url?: string | null;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RecompensasService {
  private supabase = inject(SupabaseService);

  async getRecompensas() {
    return await this.supabase.client
      .from('recompensas')
      .select('*')
      .order('tipo')
      .order('costo_puntos');
  }

  async crearRecompensa(recompensa: Recompensa) {
    return await this.supabase.client
      .from('recompensas')
      .insert([recompensa]);
  }

  async actualizarRecompensa(id: string, recompensa: Partial<Recompensa>) {
    return await this.supabase.client
      .from('recompensas')
      .update(recompensa)
      .eq('id', id);
  }

  async eliminarRecompensa(id: string) {
    return await this.supabase.client
      .from('recompensas')
      .delete()
      .eq('id', id);
  }
}