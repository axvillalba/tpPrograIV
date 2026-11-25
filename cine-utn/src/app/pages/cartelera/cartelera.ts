import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { ModalService } from '../../services/modal';
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
  private modalService = inject(ModalService);
  private router = inject(Router);

  peliculas = signal<any[]>([]);
  topVendidas = signal<any[]>([]);
  
  // Pestaña activa: 'cartelera' o 'proximamente' (incluye preventas)
  pestanaVista = signal<'cartelera' | 'proximamente'>('cartelera');

  // Conjunto de IDs de películas con alerta activada por el usuario
  alertasUsuario = signal<Set<string>>(new Set());

  filtroTexto = signal<string>('');
  filtroGenero = signal<string>('todos');

  // Lista de géneros para el selector
  generosDisponibles = ['todos', 'Acción', 'Anime', 'Ciencia Ficción', 'Animación', 'Romance', 'Aventura', 'Drama'];

  // --- SUGERENCIAS DE PELÍCULAS DEL CLIENTE ---
  mostrarFormPropuesta = signal<boolean>(false);
  enviandoPropuesta = signal<boolean>(false);
  misPropuestas = signal<any[]>([]);
  nuevaPropuesta = signal<{ titulo: string; comentario: string }>({
    titulo: '',
    comentario: ''
  });

  // Filtro dinámico en tiempo real según pestaña, texto y género
  peliculasFiltradas = computed(() => {
    const esProximamenteVista = this.pestanaVista() === 'proximamente';

    return this.peliculas().filter(p => {
      const coincidePestana = esProximamenteVista ? p.es_proximamente : !p.es_proximamente;

      const coincideTexto = p.titulo?.toLowerCase().includes(this.filtroTexto().toLowerCase()) ||
                            (p.sinopsis && p.sinopsis.toLowerCase().includes(this.filtroTexto().toLowerCase()));
      
      const coincideGenero = this.filtroGenero() === 'todos' || 
                             (p.generos && p.generos.includes(this.filtroGenero()));

      return coincidePestana && coincideTexto && coincideGenero;
    });
  });

  async ngOnInit() {
    await Promise.all([
      this.cargarPeliculasYTop(),
      this.cargarAlertasDelUsuario(),
      this.cargarMisPropuestas()
    ]);
  }

  async cargarPeliculasYTop() {
    // 1. Cargar solo películas activas (baja lógica)
    const { data: listaPeliculas } = await this.supabaseService.client
      .from('peliculas')
      .select('*')
      .eq('activa', true);

    // 2. Cargar funciones y ventas para calcular el ranking real
    const { data: listaFunciones } = await this.supabaseService.client
      .from('funciones')
      .select('id, pelicula_id');

    const { data: listaVentas } = await this.supabaseService.client
      .from('ventas')
      .select('funcion_id, detalle_butacas, estado_qr');

    if (listaPeliculas) {
      this.peliculas.set(listaPeliculas);

      if (listaVentas && listaFunciones) {
        const mapaVentasPorPelicula = new Map<string, number>();
        const funcionAPeliculaMap = new Map<string, string>();

        listaFunciones.forEach((f: any) => funcionAPeliculaMap.set(f.id, f.pelicula_id));

        listaVentas.forEach((v: any) => {
          // Excluir ventas canceladas del ranking de más vendidas
          if (v.estado_qr === 'cancelado') return;

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

  // --- MÉTODOS DE PELÍCULAS SUGERIDAS ---

  async cargarMisPropuestas() {
    const user = this.authService.currentUser();
    if (!user) {
      this.misPropuestas.set([]);
      return;
    }

    const { data, error } = await this.supabaseService.client
      .from('propuestas_peliculas')
      .select('*')
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      this.misPropuestas.set(data);
    }
  }

  async abrirFormularioPropuesta() {
    const user = this.authService.currentUser();
    if (!user) {
      await this.modalService.alerta(
        'Iniciá sesión con tu cuenta de cliente para sugerir una película al cine.',
        'Sesión Requerida',
        'warning'
      );
      this.router.navigate(['/login']);
      return;
    }

    this.mostrarFormPropuesta.update(v => !v);
  }

  async enviarPropuestaPelicula() {
    const user = this.authService.currentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    const form = this.nuevaPropuesta();
    const tituloLimpio = form.titulo.trim();

    if (!tituloLimpio) {
      await this.modalService.alerta(
        'Ingresá el nombre de la película que querés sugerir.',
        'Campo Requerido',
        'warning'
      );
      return;
    }

    const yaEnCartelera = this.peliculas().some(
      p => p.titulo?.trim().toLowerCase() === tituloLimpio.toLowerCase()
    );
    if (yaEnCartelera) {
      await this.modalService.alerta(
        '¡Buenas noticias! Esa película ya se encuentra cargada en cartelera o próximos estrenos.',
        'Ya Disponible',
        'info'
      );
      return;
    }

    this.enviandoPropuesta.set(true);
    try {
      const perfil = await this.authService.getPerfilActual();
      const nombreCliente = perfil
        ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() || 'Cliente Cine UTN'
        : 'Cliente Cine UTN';

      const { error } = await this.supabaseService.client
        .from('propuestas_peliculas')
        .insert([{
          usuario_id: user.id,
          nombre_usuario: nombreCliente,
          titulo: tituloLimpio,
          comentario: form.comentario.trim() || null,
          estado: 'pendiente'
        }]);

      if (error) throw error;

      await this.modalService.alerta(
        'Tu pedido fue enviado al gerente de Cine UTN. Te notificaremos cuando sea evaluado.',
        'Sugerencia Enviada',
        'success'
      );

      this.nuevaPropuesta.set({ titulo: '', comentario: '' });
      this.mostrarFormPropuesta.set(false);
      await this.cargarMisPropuestas();
    } catch (err: any) {
      await this.modalService.alerta(
        err.message || 'No se pudo enviar la sugerencia.',
        'Error',
        'danger'
      );
    } finally {
      this.enviandoPropuesta.set(false);
    }
  }

  // --- ALERTAS DE ESTRENOS ---

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

  async toggleAlertaEstreno(peliculaId: string) {
    const user = this.authService.currentUser();
    if (!user) {
      await this.modalService.alerta(
        'Debés iniciar sesión para recibir alertas cuando se abran las entradas.',
        'Sesión Requerida',
        'warning'
      );
      this.router.navigate(['/login']);
      return;
    }

    const setActual = new Set(this.alertasUsuario());

    if (setActual.has(peliculaId)) {
      await this.supabaseService.client
        .from('alertas_estrenos')
        .delete()
        .eq('usuario_id', user.id)
        .eq('pelicula_id', peliculaId);

      setActual.delete(peliculaId);
      await this.modalService.alerta(
        'Alerta desactivada para esta película.',
        'Notificación Desactivada',
        'info'
      );
    } else {
      await this.supabaseService.client
        .from('alertas_estrenos')
        .insert([{ usuario_id: user.id, pelicula_id: peliculaId }]);

      setActual.add(peliculaId);
      await this.modalService.alerta(
        '¡Alerta activada! Te avisaremos cuando las entradas estén disponibles.',
        'Alerta Activada',
        'success'
      );
    }

    this.alertasUsuario.set(setActual);
  }

  // --- SELECCIÓN DE PELÍCULA (CARTELERA O PREVENTA) ---

  async seleccionarPelicula(peliculaId: string) {
    if (!peliculaId) {
      console.error('No se proporcionó un ID de película válido');
      return;
    }

    const pelicula = this.peliculas().find(p => p.id === peliculaId);
    const clasificacion = pelicula?.clasificacion_edad || pelicula?.clasificacion || 'ATP';

    if (clasificacion === '+18') {
      const perfil = await this.authService.getPerfilActual();

      if (!perfil) {
        await this.modalService.alerta(
          'Debés iniciar sesión para seleccionar funciones de películas clasificadas para mayores de 18 años.',
          'Restricción de Edad (+18)',
          'warning'
        );
        this.router.navigate(['/login']);
        return;
      }

      if (perfil.fecha_nacimiento) {
        const edad = this.authService.calcularEdad(perfil.fecha_nacimiento);
        if (edad < 18) {
          await this.modalService.alerta(
            'Esta película es exclusiva para mayores de 18 años y tu perfil indica que sos menor de edad.',
            'Acceso Restringido',
            'danger'
          );
          return;
        }
      }
    }

    this.router.navigate(['/pelicula', peliculaId]);
  }
}