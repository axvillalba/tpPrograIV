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
  providedIn: 'root',
})
export class CandyService {
  private supabase = inject(SupabaseService);

  async getProductos(soloActivos: boolean = true) {
    let query = this.supabase.client
      .from('productos_candy')
      .select('*')
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });

    if (soloActivos) {
      query = query.eq('activo', true);
    }

    return await query;
  }

  async crearProducto(producto: ProductoCandy) {
    await this.supabase.client.auth.getSession();

    return await this.supabase.client
      .from('productos_candy')
      .insert([{ ...producto, activo: producto.activo ?? true }]);
  }

  async actualizarProducto(id: string, producto: Partial<ProductoCandy>) {
    await this.supabase.client.auth.getSession();

    return await this.supabase.client
      .from('productos_candy')
      .update(producto)
      .eq('id', id);
  }

  async eliminarProducto(id: string) {
    // Baja lógica para conservar el historial de ventas y reportes CSV
    await this.supabase.client.auth.getSession();

    return await this.supabase.client
      .from('productos_candy')
      .update({ activo: false })
      .eq('id', id);
  }
}