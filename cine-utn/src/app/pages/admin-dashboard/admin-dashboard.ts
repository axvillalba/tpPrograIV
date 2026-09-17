import { Component, signal, ViewChild, ElementRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboardComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private router = inject(Router);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  pestanaActiva = signal<'peliculas' | 'candy' | 'cupones' | 'funciones'>('peliculas');

  // Listas de datos
  peliculas = signal<any[]>([]);
  productosCandy = signal<any[]>([]);
  cupones = signal<any[]>([]);
  funciones = signal<any[]>([]);

  // Estados de carga y edición
  subiendoImagen = signal<boolean>(false);
  idPeliculaEditando = signal<string | null>(null);
  idCandyEditando = signal<string | null>(null);
  idCuponEditando = signal<string | null>(null);

  // Archivo local seleccionado
  archivoPosterSeleccionado: File | null = null;

  // Géneros disponibles para los checkboxes
  generosDisponibles: string[] = [
    'Acción',
    'Aventura',
    'Animación',
    'Ciencia Ficción',
    'Comedia',
    'Drama',
    'Fantasía',
    'Terror',
    'Romance',
    'Suspenso',
    'Anime',
  ];

  generosSeleccionados = signal<string[]>([]);
  idFuncionEditando = signal<string | null>(null);

  // Formulario Película
  nuevaPelicula = signal<any>({
    titulo: '',
    sinopsis: '',
    genero: '',
    duracion_minutos: 120,
    clasificacion: 'ATP',
    poster_url: '',
  });

  // Formulario Candy
  nuevoCandy = signal<any>({
    nombre: '',
    categoria: 'Pochoclos',
    precio: 0,
  });

  // Formulario Cupones
  nuevoCupon = signal<any>({
    codigo: '',
    porcentaje_descuento: 10,
    solo_mayores_50: false,
    es_primera_compra: false,
    activo: true,
  });

  // Formulario Funciones
  nuevaFuncion = signal<any>({
    pelicula_id: '',
    sala_id: '',
    fecha_hora: '',
    formato: '2D',
    idioma: 'Subtitulada',
  });

  // Salas
  salas = signal<any[]>([]);

  async ngOnInit() {
    await this.cargarDatos();
    await this.cargarSalas();
  }

  async cargarDatos() {
    const { data: pelis } = await this.supabaseService.client.from('peliculas').select('*');
    if (pelis) this.peliculas.set(pelis);

    const { data: candy } = await this.supabaseService.client.from('candy_bar').select('*');
    if (candy) this.productosCandy.set(candy);

    const { data: cups } = await this.supabaseService.client.from('cupones').select('*');
    if (cups) this.cupones.set(cups);

    const { data: funcs } = await this.supabaseService.client
      .from('funciones')
      .select('*, peliculas(titulo), salas(nombre)');
    if (funcs) this.funciones.set(funcs);
  }

  async cerrarSesion() {
    try {
      await this.authService.logout();
      this.router.navigate(['/login-staff']);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      this.router.navigate(['/login']);
    }
  }

  // --- MANEJO DE GÉNEROS ---
  toggleGenero(genero: string) {
    const actuales = [...this.generosSeleccionados()];
    const index = actuales.indexOf(genero);
    if (index > -1) {
      actuales.splice(index, 1);
    } else {
      actuales.push(genero);
    }
    this.generosSeleccionados.set(actuales);
  }

  obtenerGenerosFormateados(generosData: any): string {
    if (Array.isArray(generosData)) {
      return generosData.join(', ');
    }
    if (typeof generosData === 'string') {
      return generosData;
    }
    return 'Sin género';
  }

  // --- SELECCIÓN Y SUBIDA DE ARCHIVO ---
  onArchivoSeleccionado(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.archivoPosterSeleccionado = file;
    }
  }

  async subirPosterASupabase(file: File): Promise<string | null> {
    try {
      this.subiendoImagen.set(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `afiches/${fileName}`;

      const { error: uploadError } = await this.supabaseService.client.storage
        .from('posters')
        .upload(filePath, file);

      if (uploadError) {
        alert('Error al subir imagen a Storage: ' + uploadError.message);
        return null;
      }

      const { data } = this.supabaseService.client.storage.from('posters').getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err: any) {
      alert('Error inesperado subiendo la imagen');
      return null;
    } finally {
      this.subiendoImagen.set(false);
    }
  }

  // --- CRUD PELÍCULAS ---
  async guardarPelicula() {
    const peli = { ...this.nuevaPelicula() };
    if (!peli.titulo) return alert('Completá el título');

    const listaGeneros = this.generosSeleccionados();
    if (listaGeneros.length === 0) return alert('Seleccioná al menos un género');

    let urlImagen = peli.poster_url;

    if (this.archivoPosterSeleccionado) {
      const urlSubida = await this.subirPosterASupabase(this.archivoPosterSeleccionado);
      if (urlSubida) {
        urlImagen = urlSubida;
      } else {
        return;
      }
    }

    const payload = {
      titulo: peli.titulo,
      sinopsis: peli.sinopsis,
      duracion_minutos: peli.duracion_minutos,
      imagen_url: urlImagen,
      clasificacion_edad: peli.clasificacion,
      generos: listaGeneros,
    };

    if (this.idPeliculaEditando()) {
      const { error } = await this.supabaseService.client
        .from('peliculas')
        .update(payload)
        .eq('id', this.idPeliculaEditando());

      if (error) alert('Error al actualizar: ' + error.message);
      else this.resetFormPelicula();
    } else {
      const { error } = await this.supabaseService.client.from('peliculas').insert([payload]);

      if (error) alert('Error al crear: ' + error.message);
      else this.resetFormPelicula();
    }

    await this.cargarDatos();
  }

  editarPelicula(peli: any) {
    this.idPeliculaEditando.set(peli.id);
    this.archivoPosterSeleccionado = null;

    const generosCargados = Array.isArray(peli.generos)
      ? peli.generos
      : typeof peli.generos === 'string'
        ? peli.generos.split(',').map((g: string) => g.trim())
        : [];

    this.generosSeleccionados.set(generosCargados);

    this.nuevaPelicula.set({
      titulo: peli.titulo,
      sinopsis: peli.sinopsis || '',
      genero: '',
      duracion_minutos: peli.duracion_minutos,
      clasificacion: peli.clasificacion_edad || 'ATP',
      poster_url: peli.imagen_url || '',
    });
  }

  async eliminarPelicula(id: string) {
    if (!confirm('¿Seguro que deseas eliminar esta película?')) return;
    const { error } = await this.supabaseService.client.from('peliculas').delete().eq('id', id);
    if (error) alert('Error al eliminar: ' + error.message);
    else await this.cargarDatos();
  }

  resetFormPelicula() {
    this.archivoPosterSeleccionado = null;
    this.generosSeleccionados.set([]);
    this.idPeliculaEditando.set(null);

    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }

    this.nuevaPelicula.set({
      titulo: '',
      sinopsis: '',
      genero: '',
      duracion_minutos: 120,
      clasificacion: 'ATP',
      poster_url: '',
    });
  }

  cancelarEdicionPelicula() {
    this.resetFormPelicula();
  }

  // --- CRUD CANDY BAR ---
  async guardarCandy() {
    const prod = { ...this.nuevoCandy() };
    if (!prod.nombre) return alert('Completá el nombre del producto');

    if (this.idCandyEditando()) {
      await this.supabaseService.client
        .from('candy_bar')
        .update(prod)
        .eq('id', this.idCandyEditando());
      this.idCandyEditando.set(null);
    } else {
      await this.supabaseService.client.from('candy_bar').insert([prod]);
    }
    this.nuevoCandy.set({ nombre: '', categoria: 'Pochoclos', precio: 0 });
    await this.cargarDatos();
  }

  editarCandy(prod: any) {
    this.idCandyEditando.set(prod.id);
    this.nuevoCandy.set({ nombre: prod.nombre, categoria: prod.categoria, precio: prod.precio });
  }

  async eliminarCandy(id: string) {
    if (!confirm('¿Eliminar producto?')) return;
    await this.supabaseService.client.from('candy_bar').delete().eq('id', id);
    await this.cargarDatos();
  }

  // --- CRUD CUPONES ---
  async guardarCupon() {
    const cup = { ...this.nuevoCupon() };
    if (!cup.codigo) return alert('Completá el código');

    if (this.idCuponEditando()) {
      await this.supabaseService.client
        .from('cupones')
        .update(cup)
        .eq('id', this.idCuponEditando());
      this.idCuponEditando.set(null);
    } else {
      await this.supabaseService.client.from('cupones').insert([cup]);
    }
    this.nuevoCupon.set({
      codigo: '',
      porcentaje_descuento: 10,
      solo_mayores_50: false,
      es_primera_compra: false,
      activo: true,
    });
    await this.cargarDatos();
  }

  editarCupon(cup: any) {
    this.idCuponEditando.set(cup.id);
    this.nuevoCupon.set({ ...cup });
  }

  async eliminarCupon(id: string) {
    if (!confirm('¿Eliminar cupón?')) return;
    await this.supabaseService.client.from('cupones').delete().eq('id', id);
    await this.cargarDatos();
  }

  // --- PROGRAMACIÓN DE FUNCIONES ---
 async crearFuncionAutomatica() {
  const fn = { ...this.nuevaFuncion() };
  if (!fn.pelicula_id || !fn.fecha_hora || !fn.sala_id) {
    return alert('Por favor seleccioná Película, Sala y Fecha/Hora.');
  }

  const fechaInicio = new Date(fn.fecha_hora);
  
  // Obtener duración de la película elegida para calcular fin + 30 min de limpieza
  const peliElegida = this.peliculas().find(p => p.id === fn.pelicula_id);
  const duracionMinutos = peliElegida?.duracion_minutos || 120;
  
  const fechaFinConLimpieza = new Date(fechaInicio.getTime() + (duracionMinutos + 30) * 60000);

  // Validar solapamiento en la misma sala
  const haySolapamiento = this.funciones().some(existente => {
    // Si estamos editando, ignorar la misma función
    if (this.idFuncionEditando() && existente.id === this.idFuncionEditando()) return false;
    if (existente.sala_id !== fn.sala_id) return false;

    const inicioExistente = new Date(existente.fecha_hora);
    const duracionExistente = existente.peliculas?.duracion_minutos || 120;
    const finExistenteConLimpieza = new Date(inicioExistente.getTime() + (duracionExistente + 30) * 60000);

    // Regla de intercepción de intervalos: (StartA < EndB) y (EndA > StartB)
    return (fechaInicio < finExistenteConLimpieza && fechaFinConLimpieza > inicioExistente);
  });

  if (haySolapamiento) {
    return alert('⚠️ Conflicto de horario: La sala ya está ocupada o no cumple los 30 min de tiempo de espera y limpieza entre funciones.');
  }

  const payload = {
    pelicula_id: fn.pelicula_id,
    sala_id: fn.sala_id,
    fecha_hora: fn.fecha_hora,
    horario_inicio: fn.fecha_hora,
    horario_fin: new Date(fechaInicio.getTime() + duracionMinutos * 60000).toISOString(),
    formato: fn.formato,
    idioma: fn.idioma,
    precio_base: 4500
  };

  if (this.idFuncionEditando()) {
    const { error } = await this.supabaseService.client
      .from('funciones')
      .update(payload)
      .eq('id', this.idFuncionEditando());
      
    if (error) alert('Error al actualizar: ' + error.message);
    else this.cancelarEdicionFuncion();
  } else {
    const { error } = await this.supabaseService.client.from('funciones').insert([payload]);
    if (error) alert('Error al programar: ' + error.message);
    else this.cancelarEdicionFuncion();
  }

  await this.cargarDatos();
}

  cancelarEdicionFuncion() {
    this.idFuncionEditando.set(null);
    this.nuevaFuncion.set({
      pelicula_id: '',
      fecha_hora: '',
      formato: '2D',
      idioma: 'Subtitulada',
    });
  }
// Método para cargar los datos de la función en el formulario
editarFuncion(func: any) {
  this.idFuncionEditando.set(func.id);
  this.nuevaFuncion.set({
    pelicula_id: func.pelicula_id,
    fecha_hora: func.fecha_hora ? new Date(func.fecha_hora).toISOString().slice(0, 16) : '',
    formato: func.formato || '2D',
    idioma: func.idioma || 'Castellano'
  });
}

// Método para eliminar la función programada
async eliminarFuncion(id: string) {
  if (!confirm('¿Seguro que deseas eliminar esta función programada?')) return;
  
  const { error } = await this.supabaseService.client
    .from('funciones')
    .delete()
    .eq('id', id);

  if (error) {
    alert('Error al eliminar función: ' + error.message);
  } else {
    await this.cargarDatos();
  }
}

async cargarSalas() {
  const { data, error } = await this.supabaseService.client
    .from('salas')
    .select('*')
    .order('nombre', { ascending: true });

  if (!error && data) {
    this.salas.set(data);
  }
}
}
