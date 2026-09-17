import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './cartelera.html',
  styleUrl: './cartelera.css'
})
export class CarteleraComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  peliculas = signal<any[]>([]);
  topVendidas = signal<any[]>([]);
  
  filtroTexto = signal<string>('');
  filtroGenero = signal<string>('todos');

  // Lista de géneros para el selector
  generosDisponibles = ['todos', 'Acción', 'Anime', 'Ciencia Ficción', 'Animación', 'Romance', 'Aventura', 'Drama'];

  // Filtro dinámico en tiempo real
  peliculasFiltradas = computed(() => {
    return this.peliculas().filter(p => {
      const coincideTexto = p.titulo.toLowerCase().includes(this.filtroTexto().toLowerCase()) ||
                            (p.sinopsis && p.sinopsis.toLowerCase().includes(this.filtroTexto().toLowerCase()));
      
      const coincideGenero = this.filtroGenero() === 'todos' || 
                             (p.generos && p.generos.includes(this.filtroGenero()));

      return coincideTexto && coincideGenero;
    });
  });

  async ngOnInit() {
    await this.cargarPeliculasYTop();
  }

  async cargarPeliculasYTop() {
    // 1. Cargar películas
    const { data: listaPeliculas } = await this.supabaseService.client
      .from('peliculas')
      .select('*');

    // 2. Cargar funciones y ventas para calcular el ranking real
    const { data: listaFunciones } = await this.supabaseService.client
      .from('funciones')
      .select('id, pelicula_id');

    const { data: listaVentas } = await this.supabaseService.client
      .from('ventas')
      .select('funcion_id, detalle_butacas');

    if (listaPeliculas) {
      this.peliculas.set(listaPeliculas);

      // Calcular Ranking Top 3 según entradas vendidas en Supabase
      if (listaVentas && listaFunciones) {
        const mapaVentasPorPelicula = new Map<string, number>();
        const funcionAPeliculaMap = new Map<string, string>();

        listaFunciones.forEach((f: any) => funcionAPeliculaMap.set(f.id, f.pelicula_id));

        listaVentas.forEach((v: any) => {
          const peliculaId = funcionAPeliculaMap.get(v.funcion_id);
          if (peliculaId && v.detalle_butacas) {
            const cantEntradas = Array.isArray(v.detalle_butacas) ? v.detalle_butacas.length : 0;
            const actual = mapaVentasPorPelicula.get(peliculaId) || 0;
            mapaVentasPorPelicula.set(peliculaId, actual + cantEntradas);
          }
        });

        const peliculasConConteo = listaPeliculas.map(p => ({
          ...p,
          entradasVendidas: mapaVentasPorPelicula.get(p.id) || 0
        })).sort((a, b) => b.entradasVendidas - a.entradasVendidas);

        this.topVendidas.set(peliculasConConteo.slice(0, 3));
      } else {
        this.topVendidas.set(listaPeliculas.slice(0, 3));
      }
    }
  }

seleccionarPelicula(peliculaId: string) {
  if (!peliculaId) {
    console.error('No se proporcionó un ID de película válido');
    return;
  }
  this.router.navigate(['/pelicula', peliculaId]);
}
}