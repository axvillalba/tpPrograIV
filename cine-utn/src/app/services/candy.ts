import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase'; 

export interface ProductoCandy {
  id?: string;
  nombre: string;
  descripcion?: string | null;
  categoria: string;
  precio: number;
  imagen_url?: string | null;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class CandyService {
  private supabase = inject(SupabaseService);

  async getProductos() {
    return await this.supabase.client
      .from('productos_candy')
      .select('*')
      .order('categoria')
      .order('nombre');
  }

  async crearProducto(producto: ProductoCandy) {
    return await this.supabase.client
      .from('productos_candy')
      .insert([producto]);
  }

  async actualizarProducto(id: string, producto: Partial<ProductoCandy>) {
    return await this.supabase.client
      .from('productos_candy')
      .update(producto)
      .eq('id', id);
  }

  async eliminarProducto(id: string) {
    return await this.supabase.client
      .from('productos_candy')
      .delete()
      .eq('id', id);
  }
}