import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase'; 

export interface Cupon {
  id?: string;
  codigo: string;
  porcentaje_descuento: number;
  solo_mayores_50?: boolean;
  es_primera_compra?: boolean;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CuponesService {
  private supabase = inject(SupabaseService);

  async getCupones() {
    return await this.supabase.client
      .from('cupones')
      .select('*')
      .order('codigo');
  }

  async crearCupon(cupon: Cupon) {
    return await this.supabase.client
      .from('cupones')
      .insert([cupon]);
  }

  async actualizarCupon(id: string, cupon: Partial<Cupon>) {
    return await this.supabase.client
      .from('cupones')
      .update(cupon)
      .eq('id', id);
  }

  async eliminarCupon(id: string) {
    return await this.supabase.client
      .from('cupones')
      .delete()
      .eq('id', id);
  }
}