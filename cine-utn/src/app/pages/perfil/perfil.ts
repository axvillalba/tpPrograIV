import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class PerfilComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  // Variables de clase tradicionales (sin señales para evitar inferencias estrictas)
  perfilUsuario: any = null;
  ventas: any[] = [];
  resenasDelUsuario: any[] = [];
  peliculasCompradas: any[] = [];
  cargando: boolean = true;

  // Estado del formulario de reseña
  peliculaParaResenar: any = null;
  calificacionSeleccionada: number = 5;
  comentarioInput: string = '';
  enviandoResena: boolean = false;
  mensajeExito: string | null = null;

  async ngOnInit() {
    try {
      // 1. Verificar si hay un usuario logueado en Supabase Auth
      const user = this.authService.currentUser();

      // 2. Intentar obtener el perfil detallado de 'perfiles'
      let perfil = await this.authService.getPerfilActual();

      // Si hay usuario en Auth pero no en la tabla perfiles, armamos un objeto temporal con su email
      if (!perfil && user) {
        perfil = {
          id: user.id,
          email: user.email,
          nombre: user.user_metadata?.['nombre'] || 'Usuario',
          apellido: user.user_metadata?.['apellido'] || '',
          rol: user.user_metadata?.['rol'] || 'cliente',
        };
      }

      // 3. Si definitivamente no hay sesión activa en Auth, redirigir a Login
      if (!user && !perfil) {
        this.router.navigate(['/login']);
        return;
      }

      this.perfilUsuario = perfil;

      // Cargar historial si tenemos ID válido
      if (perfil?.id) {
        await Promise.all([
          this.cargarHistorialVentas(perfil.id),
          this.cargarResenasDelUsuario(perfil.id),
        ]);
        this.procesarPeliculasCompradas();
      }
    } catch (error) {
      console.error('Error al inicializar Perfil:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  async cargarHistorialVentas(userId: string) {
    try {
      // 1. Consulta directa a 'ventas' por el ID de usuario sin join estricto para evitar fallos por FK
      const { data: ventasData, error: ventasError } = await this.supabaseService.client
        .from('ventas')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (ventasError) {
        console.error('Error al obtener ventas:', ventasError);
        this.ventas = [];
        return;
      }

      if (!ventasData || ventasData.length === 0) {
        this.ventas = [];
        return;
      }

      // 2. Extraer los IDs de las funciones registradas en esas ventas
      const funcionIds = ventasData
        .map((v: any) => v.funcion_id)
        .filter((id: any) => id !== null && id !== undefined);

      if (funcionIds.length === 0) {
        this.ventas = ventasData;
        return;
      }

      // 3. Traer las funciones y sus películas correspondientes
      const { data: funcionesData } = await this.supabaseService.client
        .from('funciones')
        .select('*, peliculas(*)')
        .in('id', funcionIds);

      // 4. Mapear las funciones dentro de cada venta
      const funcionesMap = new Map();
      if (funcionesData) {
        funcionesData.forEach((f: any) => funcionesMap.set(f.id, f));
      }

      this.ventas = ventasData.map((venta: any) => ({
        ...venta,
        funcion: funcionesMap.get(venta.funcion_id) || null,
      }));
    } catch (err) {
      console.error('Excepción al cargar historial:', err);
    }
  }

  async cargarResenasDelUsuario(userId: string) {
    const { data } = await this.supabaseService.client
      .from('resenas')
      .select('*, peliculas(titulo)')
      .eq('usuario_id', userId);

    if (data) {
      this.resenasDelUsuario = data;
    }
  }

  procesarPeliculasCompradas() {
    const pelisMap = new Map();

    this.ventas.forEach((v: any) => {
      const peli = v.funcion?.peliculas;
      if (peli && peli.id && !pelisMap.has(peli.id)) {
        pelisMap.set(peli.id, peli);
      }
    });

    this.peliculasCompradas = Array.from(pelisMap.values());
  }

  yaTieneResena(peliculaId: string): boolean {
    return this.resenasDelUsuario.some((r: any) => r.pelicula_id === peliculaId);
  }

  abrirFormularioResena(pelicula: any) {
    this.peliculaParaResenar = pelicula;
    this.calificacionSeleccionada = 5;
    this.comentarioInput = '';
    this.mensajeExito = null;
  }

  cancelarResena() {
    this.peliculaParaResenar = null;
  }

  async enviarResena() {
    const peli = this.peliculaParaResenar;
    const comentario = this.comentarioInput.trim();
    const perfil = this.perfilUsuario;

    if (!peli || !comentario) {
      return alert('Escribí un comentario para publicar la reseña.');
    }

    this.enviandoResena = true;

    const nom = perfil?.nombre ? perfil.nombre.trim() : '';
    const ape = perfil?.apellido ? perfil.apellido.trim() : '';
    const nombreCompleto = nom || ape ? `${nom} ${ape}`.trim() : 'Cliente Cine UTN';

    const nuevaResena = {
      pelicula_id: peli.id,
      usuario_id: perfil?.id || null,
      nombre_usuario: nombreCompleto,
      calificacion: Number(this.calificacionSeleccionada),
      comentario: comentario,
    };

    const { error } = await this.supabaseService.client.from('resenas').insert([nuevaResena]);

    this.enviandoResena = false;

    if (error) {
      alert('Error al guardar la reseña: ' + error.message);
    } else {
      this.mensajeExito = '¡Tu reseña fue publicada con éxito!';
      if (perfil?.id) {
        await this.cargarResenasDelUsuario(perfil.id);
      }
      this.cdr.detectChanges();

      setTimeout(() => {
        this.peliculaParaResenar = null;
        this.cdr.detectChanges();
      }, 2000);
    }
  }
  formatearFecha(fechaRaw: string): string {
    if (!fechaRaw) return 'N/A';
    const f = new Date(fechaRaw);
    return f.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
