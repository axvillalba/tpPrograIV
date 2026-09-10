import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export interface Pelicula {
  id: string;
  titulo: string;
  sinopsis: string;
  duracion_minutos: number;
  imagen_url: string;
  clasificacion_edad: 'ATP' | '+13' | '+18';
  generos: string[];
  destacada?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class PeliculasService {
  peliculas = signal<Pelicula[]>([]);

  constructor(private supabaseService: SupabaseService) {}

  async obtenerPeliculas() {
    const { data, error } = await this.supabaseService.client
      .from('peliculas')
      .select('*');

    if (error) throw error;
    this.peliculas.set(data || []);
    return data;
  }

  async obtenerMasVendidas(): Promise<Pelicula[]> {
    const { data, error } = await this.supabaseService.client
      .from('peliculas')
      .select('*')
      .eq('destacada', true)
      .limit(3);

    if (error) throw error;
    return data || [];
  }
}