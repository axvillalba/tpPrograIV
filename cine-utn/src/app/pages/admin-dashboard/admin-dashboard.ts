import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private router = inject(Router);

  pestanaActiva = signal<'peliculas' | 'candy' | 'cupones' | 'funciones'>('peliculas');
  cargando = signal<boolean>(false);

  // Datos
  peliculas = signal<any[]>([]);
  productosCandy = signal<any[]>([]);
  cupones = signal<any[]>([]);
  funciones = signal<any[]>([]);
  salas = signal<any[]>([]);

  // Modos Edición
  idPeliculaEditando = signal<string | null>(null);
  idCandyEditando = signal<string | null>(null);
  idCuponEditando = signal<string | null>(null);

  // Formulario Película
  nuevaPelicula = signal({
    titulo: '', sinopsis: '', genero: '', duracion_minutos: 120, clasificacion: 'ATP', poster_url: ''
  });

  // Formulario Candy
  nuevoCandy = signal({
    nombre: '', categoria: 'Pochoclos', precio: 0, imagen_url: ''
  });

  // Formulario Cupón
  nuevoCupon = signal({
    codigo: '', porcentaje_descuento: 10, solo_mayores_50: false, es_primera_compra: false, activo: true
  });

  // Formulario Función Automática
  nuevaFuncion = signal({
    pelicula_id: '', fecha_hora: '', formato: '2D', idioma: 'Subtitulada', precio_base: 3500
  });

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    this.cargando.set(true);
    try {
      const [resPeli, resCandy, resCupones, resSalas, resFunc] = await Promise.all([
        this.supabaseService.client.from('peliculas').select('*').order('titulo'),
        this.supabaseService.client.from('productos_candy').select('*').order('categoria'),
        this.supabaseService.client.from('cupones').select('*').order('codigo'),
        this.supabaseService.client.from('salas').select('*'),
        this.supabaseService.client.from('funciones').select('*, peliculas(titulo), salas(nombre)')
      ]);

      if (resPeli.data) this.peliculas.set(resPeli.data);
      if (resCandy.data) this.productosCandy.set(resCandy.data);
      if (resCupones.data) this.cupones.set(resCupones.data);
      if (resSalas.data) this.salas.set(resSalas.data);
      if (resFunc.data) this.funciones.set(resFunc.data);
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  // --- PELÍCULAS ---
  async guardarPelicula() {
    const peli = this.nuevaPelicula();
    if (!peli.titulo || !peli.genero) return alert('Completá título y género');

    if (this.idPeliculaEditando()) {
      const { error } = await this.supabaseService.client
        .from('peliculas')
        .update(peli)
        .eq('id', this.idPeliculaEditando());
      if (error) alert('Error al actualizar: ' + error.message);
      else this.cancelarEdicionPelicula();
    } else {
      const { error } = await this.supabaseService.client.from('peliculas').insert(peli);
      if (error) alert('Error al crear: ' + error.message);
      else this.resetFormPelicula();
    }
    await this.cargarDatos();
  }

  editarPelicula(peli: any) {
    this.idPeliculaEditando.set(peli.id);
    this.nuevaPelicula.set({
      titulo: peli.titulo,
      sinopsis: peli.sinopsis || '',
      genero: peli.genero,
      duracion_minutos: peli.duracion_minutos,
      clasificacion: peli.clasificacion,
      poster_url: peli.poster_url || ''
    });
  }

  cancelarEdicionPelicula() {
    this.idPeliculaEditando.set(null);
    this.resetFormPelicula();
  }

  resetFormPelicula() {
    this.nuevaPelicula.set({ titulo: '', sinopsis: '', genero: '', duracion_minutos: 120, clasificacion: 'ATP', poster_url: '' });
  }

  async eliminarPelicula(id: string) {
    if (!confirm('¿Eliminar esta película?')) return;
    await this.supabaseService.client.from('peliculas').delete().eq('id', id);
    await this.cargarDatos();
  }

  // --- CANDY BAR ---
  async guardarCandy() {
    const item = this.nuevoCandy();
    if (!item.nombre || item.precio <= 0) return alert('Ingresá un nombre y precio válido');

    if (this.idCandyEditando()) {
      await this.supabaseService.client.from('productos_candy').update(item).eq('id', this.idCandyEditando());
      this.idCandyEditando.set(null);
    } else {
      await this.supabaseService.client.from('productos_candy').insert(item);
    }
    this.nuevoCandy.set({ nombre: '', categoria: 'Pochoclos', precio: 0, imagen_url: '' });
    await this.cargarDatos();
  }

  editarCandy(item: any) {
    this.idCandyEditando.set(item.id);
    this.nuevoCandy.set({ nombre: item.nombre, categoria: item.categoria, precio: item.precio, imagen_url: item.imagen_url || '' });
  }

  async eliminarCandy(id: string) {
    if (!confirm('¿Eliminar este producto?')) return;
    await this.supabaseService.client.from('productos_candy').delete().eq('id', id);
    await this.cargarDatos();
  }

  // --- CUPONES ---
  async guardarCupon() {
    const cup = this.nuevoCupon();
    cup.codigo = cup.codigo.trim().toUpperCase();
    if (!cup.codigo) return alert('Ingresá un código');

    if (this.idCuponEditando()) {
      await this.supabaseService.client.from('cupones').update(cup).eq('id', this.idCuponEditando());
      this.idCuponEditando.set(null);
    } else {
      await this.supabaseService.client.from('cupones').insert(cup);
    }
    this.nuevoCupon.set({ codigo: '', porcentaje_descuento: 10, solo_mayores_50: false, es_primera_compra: false, activo: true });
    await this.cargarDatos();
  }

  editarCupon(cup: any) {
    this.idCuponEditando.set(cup.id);
    this.nuevoCupon.set({
      codigo: cup.codigo,
      porcentaje_descuento: cup.porcentaje_descuento,
      solo_mayores_50: cup.solo_mayores_50,
      es_primera_compra: cup.es_primera_compra,
      activo: cup.activo
    });
  }

  async eliminarCupon(id: string) {
    if (!confirm('¿Eliminar este cupón?')) return;
    await this.supabaseService.client.from('cupones').delete().eq('id', id);
    await this.cargarDatos();
  }

  // --- ASIGNACIÓN AUTOMÁTICA DE SALAS ---
  async crearFuncionAutomatica() {
    const f = this.nuevaFuncion();
    if (!f.pelicula_id || !f.fecha_hora) return alert('Seleccioná película y horario');

    // Buscar sala disponible que no tenga conflicto de horario
    const fechaInicio = new Date(f.fecha_hora);
    const peli = this.peliculas().find(p => p.id === f.pelicula_id);
    const duracionMs = ((peli?.duracion_minutos || 120) + 30) * 60 * 1000; // Duración + 30m de limpieza
    const fechaFin = new Date(fechaInicio.getTime() + duracionMs);

    // Filtrar salas disponibles
    let salaAsignadaId = null;
    for (const sala of this.salas()) {
      const { data: conflictos } = await this.supabaseService.client
        .from('funciones')
        .select('id')
        .eq('sala_id', sala.id)
        .gte('fecha_hora', new Date(fechaInicio.getTime() - (2 * 60 * 60 * 1000)).toISOString())
        .lte('fecha_hora', fechaFin.toISOString());

      if (!conflictos || conflictos.length === 0) {
        salaAsignadaId = sala.id;
        break;
      }
    }

    if (!salaAsignadaId && this.salas().length > 0) {
      salaAsignadaId = this.salas()[0].id; // Fallback a Sala 1 si no hay conflicto estricto
    }

    const { error } = await this.supabaseService.client.from('funciones').insert({
      pelicula_id: f.pelicula_id,
      sala_id: salaAsignadaId,
      fecha_hora: f.fecha_hora,
      formato: f.formato,
      idioma: f.idioma,
      precio_base: f.precio_base
    });

    if (error) alert('Error creando función: ' + error.message);
    else {
      alert('Función programada y sala asignada automáticamente.');
      await this.cargarDatos();
    }
  }

  async cerrarSesion() {
    await this.authService.logout();
    this.router.navigate(['/login-staff']);
  }
}