import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
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
  private authService = inject(AuthService);
  private router = inject(Router);

  peliculas = signal<any[]>([]);
  topVendidas = signal<any[]>([]);
  
  // Pestaña activa: 'cartelera' o 'proximamente'
  pestanaVista = signal<'cartelera' | 'proximamente'>('cartelera');

  // Conjunto de IDs de películas con alerta activada por el usuario
  alertasUsuario = signal<Set<string>>(new Set());

  filtroTexto = signal<string>('');
  filtroGenero = signal<string>('todos');

  // Lista de géneros para el selector
  generosDisponibles = ['todos', 'Acción', 'Anime', 'Ciencia Ficción', 'Animación', 'Romance', 'Aventura', 'Drama'];

  // Filtro dinámico en tiempo real según pestaña, texto y género
  peliculasFiltradas = computed(() => {
    const esProximamenteVista = this.pestanaVista() === 'proximamente';

    return this.peliculas().filter(p => {
      // Filtrar por estado 'Próximamente' o 'En Cartelera'
      const coincidePestana = esProximamenteVista ? p.es_proximamente : !p.es_proximamente;

      const coincideTexto = p.titulo?.toLowerCase().includes(this.filtroTexto().toLowerCase()) ||
                            (p.sinopsis && p.sinopsis.toLowerCase().includes(this.filtroTexto().toLowerCase()));
      
      const coincideGenero = this.filtroGenero() === 'todos' || 
                             (p.generos && p.generos.includes(this.filtroGenero()));

      return coincidePestana && coincideTexto && coincideGenero;
    });
  });

  async ngOnInit() {
    await this.cargarPeliculasYTop();
    await this.cargarAlertasDelUsuario();
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

  

  // Cargar las alertas activadas por el usuario logueado
  async cargarAlertasDelUsuario() {
    const user = this.authService.currentUser();
    if (!user) return;

    const { data } = await this.supabaseService.client
      .from('alertas_estrenos')
      .select('pelicula_id')
      .eq('usuario_id', user.id);

    if (data) {
      const set = new Set<string>(data.map((a: any) => a.pelicula_id));
      this.alertasUsuario.set(set);
    }
  }

  // Activar o desactivar recordatorios para estrenos
  async toggleAlertaEstreno(peliculaId: string) {
    const user = this.authService.currentUser();
    if (!user) {
      alert('Debés iniciar sesión para recibir alertas cuando se abran las entradas.');
      this.router.navigate(['/login']);
      return;
    }

    const setActual = new Set(this.alertasUsuario());

    if (setActual.has(peliculaId)) {
      // Eliminar la alerta
      await this.supabaseService.client
        .from('alertas_estrenos')
        .delete()
        .eq('usuario_id', user.id)
        .eq('pelicula_id', peliculaId);

      setActual.delete(peliculaId);
      alert('🔔 Alerta desactivada para esta película.');
    } else {
      // Registrar la alerta
      await this.supabaseService.client
        .from('alertas_estrenos')
        .insert([{ usuario_id: user.id, pelicula_id: peliculaId }]);

      setActual.add(peliculaId);
      alert('🔔 ¡Alerta activada! Te avisaremos cuando las entradas estén disponibles.');
    }

    this.alertasUsuario.set(setActual);
  }

async seleccionarPelicula(peliculaId: string) {
    if (!peliculaId) {
      console.error('No se proporcionó un ID de película válido');
      return;
    }

    // 1. Buscar la película en el listado cargado
    const pelicula = this.peliculas().find(p => p.id === peliculaId);
    const clasificacion = pelicula?.clasificacion_edad || pelicula?.clasificacion || 'ATP';

    // 2. Control de restricción +18
    if (clasificacion === '+18') {
      const perfil = await this.authService.getPerfilActual();

      if (!perfil) {
        alert('Debés iniciar sesión para seleccionar funciones de películas clasificadas para mayores de 18 años.');
        this.router.navigate(['/login']);
        return;
      }

      if (perfil.fecha_nacimiento) {
        const edad = this.authService.calcularEdad(perfil.fecha_nacimiento);
        if (edad < 18) {
          alert('⛔ Acceso restringido: Esta película es exclusiva para mayores de 18 años y tu perfil indica que sos menor de edad.');
          return;
        }
      }
    }

    // 3. Si cumple los requisitos, navega a la vista de la película
    this.router.navigate(['/pelicula', peliculaId]);
  }
}