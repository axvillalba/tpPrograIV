import { Component, signal, ViewChild, ElementRef, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';
import { CandyService } from '../../services/candy';
import { CuponesService } from '../../services/cupones';
import { RecompensasService } from '../../services/recompensas';

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
  private cdr = inject(ChangeDetectorRef);

  // Servicios inyectados
  private candyService = inject(CandyService);
  private cuponesService = inject(CuponesService);
  private recompensasService = inject(RecompensasService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInputCandy') fileInputCandy!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInputRecompensa') fileInputRecompensa!: ElementRef<HTMLInputElement>;

  pestanaActiva = signal<'peliculas' | 'candy' | 'cupones' | 'funciones' | 'recompensas'>('peliculas');

  // Listas de datos
  peliculas = signal<any[]>([]);
  productosCandy = signal<any[]>([]);
  cupones = signal<any[]>([]);
  funciones = signal<any[]>([]);
  salas = signal<any[]>([]);
  recompensas = signal<any[]>([]);

  // Estados de carga y edición
  subiendoImagen = signal<boolean>(false);
  idPeliculaEditando = signal<string | null>(null);
  idCandyEditando = signal<string | null>(null);
  idCuponEditando = signal<string | null>(null);
  idFuncionEditando = signal<string | null>(null);
  idRecompensaEditando = signal<string | null>(null);

  // Archivos seleccionados
  archivoPosterSeleccionado: File | null = null;
  archivoCandySeleccionado: File | null = null;
  archivoRecompensaSeleccionado: File | null = null;

  // Géneros disponibles para los checkboxes
  generosDisponibles: string[] = [
    'Acción', 'Aventura', 'Animación', 'Ciencia Ficción',
    'Comedia', 'Drama', 'Fantasía', 'Terror',
    'Romance', 'Suspenso', 'Anime'
  ];

  generosSeleccionados = signal<string[]>([]);

  // Formulario Película actualizado
  nuevaPelicula = signal<any>({
    titulo: '',
    sinopsis: '',
    genero: '',
    duracion_minutos: 120,
    clasificacion: 'ATP',
    poster_url: '',
    es_proximamente: false,
    fecha_estreno: '',
    es_preventa: false,
    precio_preventa: 0
  });

  // Formulario Candy
  nuevoCandy = signal<any>({
    nombre: '',
    categoria: 'Pochoclos',
    precio: 0,
    imagen_url: '',
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

  // Formulario Recompensas
  nuevaRecompensa = signal<any>({
    nombre: '',
    descripcion: '',
    costo_puntos: 100,
    tipo: 'Entrada',
    imagen_url: '',
    activo: true
  });

  // Programación Recurrente
  periodoRecurrencia: number = 1; // Cantidad de semanas (1, 2 o 4)
  diasSemana = [
    { id: 1, nombre: 'Lun', seleccionado: false },
    { id: 2, nombre: 'Mar', seleccionado: false },
    { id: 3, nombre: 'Mié', seleccionado: false },
    { id: 4, nombre: 'Jue', seleccionado: false },
    { id: 5, nombre: 'Vie', seleccionado: false },
    { id: 6, nombre: 'Sáb', seleccionado: false },
    { id: 0, nombre: 'Dom', seleccionado: false }
  ];

  async ngOnInit() {
    await this.cargarDatos();
    await this.cargarSalas();
  }

  async cargarDatos() {
    const hoy = new Date().toISOString();

    const [resPelis, resCandy, resCups, resFuncs, resRecompensas] = await Promise.all([
      this.supabaseService.client.from('peliculas').select('*'),
      this.candyService.getProductos(),
      this.cuponesService.getCupones(),
      this.supabaseService.client.from('funciones').select('*, peliculas(titulo, duracion_minutos), salas(nombre)').gte('horario_fin', hoy).order('fecha_hora', { ascending: true }),
      this.recompensasService.getRecompensas()
    ]);

    if (resPelis.data) this.peliculas.set(resPelis.data);
    if (resCandy.data) this.productosCandy.set(resCandy.data);
    if (resCups.data) this.cupones.set(resCups.data);
    if (resFuncs.data) this.funciones.set(resFuncs.data);
    if (resRecompensas.data) this.recompensas.set(resRecompensas.data);
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

  // --- SUBIDA DE IMÁGENES ---
  onArchivoSeleccionado(event: any) {
    const file = event.target.files[0];
    if (file) this.archivoPosterSeleccionado = file;
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
      es_proximamente: peli.es_proximamente || false,
      fecha_estreno: peli.fecha_estreno || null,
      es_preventa: peli.es_preventa || false,
      precio_preventa: Number(peli.precio_preventa) || 0
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

    if (!prod.nombre) return alert('Completá el nombre del producto.');
    if (prod.precio <= 0 || prod.precio > 999999) {
      return alert('El precio debe ser mayor a $0 y menor a $999.999.');
    }

    let urlImagen = prod.imagen_url;
    if (this.archivoCandySeleccionado) {
      const urlSubida = await this.subirImagenCandyASupabase(this.archivoCandySeleccionado);
      if (urlSubida) {
        urlImagen = urlSubida;
      } else {
        return;
      }
    }
    prod.imagen_url = urlImagen;

    if (this.idCandyEditando()) {
      const { error } = await this.candyService.actualizarProducto(this.idCandyEditando()!, prod);
      if (error) alert('Error al actualizar: ' + error.message);
      else this.cancelarEdicionCandy();
    } else {
      const { error } = await this.candyService.crearProducto(prod);
      if (error) alert('Error al crear: ' + error.message);
      else this.cancelarEdicionCandy();
    }

    await this.cargarDatos();
  }

  editarCandy(prod: any) {
    this.idCandyEditando.set(prod.id);
    this.archivoCandySeleccionado = null;
    this.nuevoCandy.set({
      nombre: prod.nombre,
      categoria: prod.categoria,
      precio: prod.precio,
      imagen_url: prod.imagen_url || ''
    });
  }

  async eliminarCandy(id: string) {
    if (!confirm('¿Eliminar producto?')) return;
    const { error } = await this.candyService.eliminarProducto(id);
    if (error) alert('Error al eliminar: ' + error.message);
    else await this.cargarDatos();
  }

  cancelarEdicionCandy() {
    this.idCandyEditando.set(null);
    this.archivoCandySeleccionado = null;

    if (this.fileInputCandy && this.fileInputCandy.nativeElement) {
      this.fileInputCandy.nativeElement.value = '';
    }

    this.nuevoCandy.set({ nombre: '', categoria: 'Pochoclos', precio: 0, imagen_url: '' });
  }

  onArchivoCandySeleccionado(event: any) {
    const file = event.target.files[0];
    if (file) this.archivoCandySeleccionado = file;
  }

  async subirImagenCandyASupabase(file: File): Promise<string | null> {
    try {
      this.subiendoImagen.set(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `candy_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `candy/${fileName}`;

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

  // --- CRUD CUPONES ---
  async guardarCupon() {
    const cup = { ...this.nuevoCupon() };
    if (!cup.codigo || cup.porcentaje_descuento <= 0 || cup.porcentaje_descuento > 100) {
      return alert('Por favor, ingresá un código y un descuento válido entre 1 y 100.');
    }

    cup.codigo = cup.codigo.toUpperCase().trim();

    if (this.idCuponEditando()) {
      const { error } = await this.cuponesService.actualizarCupon(this.idCuponEditando()!, cup);
      if (error) alert('Error al actualizar: ' + error.message);
      else this.idCuponEditando.set(null);
    } else {
      const { error } = await this.cuponesService.crearCupon(cup);
      if (error) alert('Error al crear: ' + error.message);
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
    const { error } = await this.cuponesService.eliminarCupon(id);
    if (error) alert('Error al eliminar: ' + error.message);
    else await this.cargarDatos();
  }

  // --- PROGRAMACIÓN DE FUNCIONES CON RECURRENCIA ---
  hayDiasSeleccionados(): boolean {
    return this.diasSemana.some(d => d.seleccionado);
  }

  resetearDiasSemana() {
    this.diasSemana.forEach(d => d.seleccionado = false);
    this.periodoRecurrencia = 1;
  }

  async crearFuncionAutomatica() {
    const fn = { ...this.nuevaFuncion() };

    if (!fn.pelicula_id || !fn.fecha_hora || !fn.sala_id) {
      return alert('Por favor seleccioná Película, Sala y Fecha/Hora.');
    }

    const fechaInicioBase = new Date(fn.fecha_hora);
    const ahora = new Date();

    if (fechaInicioBase < ahora && !this.idFuncionEditando()) {
      return alert('Error: No podés programar una nueva función en un horario pasado.');
    }

    const peliElegida = this.peliculas().find(p => p.id === fn.pelicula_id);
    const duracionMinutos = peliElegida?.duracion_minutos || 120;

    // Determinar fechas a procesar
    const diasElegidos = this.diasSemana.filter(d => d.seleccionado).map(d => d.id);
    const fechasAProgramar: Date[] = [];

    if (this.idFuncionEditando() || diasElegidos.length === 0) {
      fechasAProgramar.push(fechaInicioBase);
    } else {
      const totalDias = Number(this.periodoRecurrencia) * 7;
      for (let i = 0; i < totalDias; i++) {
        const fechaEval = new Date(fechaInicioBase);
        fechaEval.setDate(fechaInicioBase.getDate() + i);

        if (diasElegidos.includes(fechaEval.getDay())) {
          fechasAProgramar.push(fechaEval);
        }
      }
    }

    const funcionesExistentes = [...this.funciones()];
    const nuevasFuncionesPayload: any[] = [];
    let omitidasPorSolapamiento = 0;

    for (const fechaInicio of fechasAProgramar) {
      const fechaFinConLimpieza = new Date(fechaInicio.getTime() + ((duracionMinutos + 30) * 60000));

      const haySolapamiento = funcionesExistentes.some(existente => {
        if (this.idFuncionEditando() && existente.id === this.idFuncionEditando()) return false;
        if (existente.sala_id !== fn.sala_id) return false;

        const inicioExistente = new Date(existente.fecha_hora || existente.horario_inicio);
        const duracionExistente = existente.peliculas?.duracion_minutos || 120;
        const finExistenteConLimpieza = new Date(inicioExistente.getTime() + ((duracionExistente + 30) * 60000));

        return (fechaInicio < finExistenteConLimpieza && fechaFinConLimpieza > inicioExistente);
      });

      if (haySolapamiento) {
        omitidasPorSolapamiento++;
      } else {
        const payload = {
          pelicula_id: fn.pelicula_id,
          sala_id: fn.sala_id,
          fecha_hora: fechaInicio.toISOString(),
          horario_inicio: fechaInicio.toISOString(),
          horario_fin: new Date(fechaInicio.getTime() + (duracionMinutos * 60000)).toISOString(),
          formato: fn.formato,
          idioma: fn.idioma,
          precio_base: 4500
        };
        nuevasFuncionesPayload.push(payload);
        funcionesExistentes.push(payload);
      }
    }

    if (nuevasFuncionesPayload.length === 0) {
      return alert('⚠️ CONFLICTO DE SALA:\n\nLa sala seleccionada está ocupada en ese horario o no se respeta el margen obligatorio de 30 minutos de limpieza entre funciones.');
    }

    if (this.idFuncionEditando()) {
      const { error } = await this.supabaseService.client
        .from('funciones')
        .update(nuevasFuncionesPayload[0])
        .eq('id', this.idFuncionEditando());

      if (error) alert('Error al actualizar: ' + error.message);
      else this.cancelarEdicionFuncion();
    } else {
      const { error } = await this.supabaseService.client
        .from('funciones')
        .insert(nuevasFuncionesPayload);

      if (error) {
        alert('Error al programar: ' + error.message);
      } else {
        let msg = `✔️ Se programó ${nuevasFuncionesPayload.length} función(es) con éxito.`;
        if (omitidasPorSolapamiento > 0) {
          msg += `\n⚠️ ${omitidasPorSolapamiento} fecha(s) omitida(s) por superposición.`;
        }
        alert(msg);
        this.cancelarEdicionFuncion();
      }
    }

    await this.cargarDatos();
  }

  cancelarEdicionFuncion() {
    this.idFuncionEditando.set(null);
    this.nuevaFuncion.set({
      pelicula_id: '',
      sala_id: '',
      fecha_hora: '',
      formato: '2D',
      idioma: 'Subtitulada',
    });
    this.resetearDiasSemana();
  }

  editarFuncion(func: any) {
    let fechaFormateada = '';

    if (func.fecha_hora) {
      const dateObj = new Date(func.fecha_hora);
      const localDate = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
      fechaFormateada = localDate.toISOString().slice(0, 16);
    }

    this.idFuncionEditando.set(func.id);
    this.nuevaFuncion.set({
      pelicula_id: func.pelicula_id,
      sala_id: func.sala_id,
      fecha_hora: fechaFormateada,
      formato: func.formato || '2D',
      idioma: func.idioma || 'Castellano'
    });
  }

  async eliminarFuncion(id: string) {
    if (!confirm('¿Seguro que deseas eliminar esta función programada?')) return;

    const { error } = await this.supabaseService.client
      .from('funciones')
      .delete()
      .eq('id', id);

    if (error) alert('Error al eliminar función: ' + error.message);
    else await this.cargarDatos();
  }

  // --- CRUD RECOMPENSAS ---
  onArchivoRecompensaSeleccionado(event: any) {
    const file = event.target.files[0];
    if (file) this.archivoRecompensaSeleccionado = file;
  }

  async subirImagenRecompensa(file: File): Promise<string | null> {
    try {
      this.subiendoImagen.set(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `recompensa_${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `recompensas/${fileName}`;

      const { error: uploadError } = await this.supabaseService.client.storage.from('posters').upload(filePath, file);
      if (uploadError) {
        alert('Error al subir imagen: ' + uploadError.message);
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

  async guardarRecompensa() {
    const rec = { ...this.nuevaRecompensa() };
    if (!rec.nombre || rec.costo_puntos <= 0) return alert('Completá nombre y un costo válido en puntos.');

    let urlImagen = rec.imagen_url;
    if (this.archivoRecompensaSeleccionado) {
      const urlSubida = await this.subirImagenRecompensa(this.archivoRecompensaSeleccionado);
      if (urlSubida) urlImagen = urlSubida;
      else return;
    }

    const payload = {
      nombre: rec.nombre,
      descripcion: rec.descripcion || null,
      costo_puntos: Number(rec.costo_puntos),
      tipo: rec.tipo,
      imagen_url: urlImagen || null,
      activo: rec.activo !== undefined ? rec.activo : true
    };

    if (this.idRecompensaEditando()) {
      const { error } = await this.recompensasService.actualizarRecompensa(this.idRecompensaEditando()!, payload);
      if (error) alert('Error al actualizar: ' + error.message);
      else this.cancelarEdicionRecompensa();
    } else {
      const { error } = await this.recompensasService.crearRecompensa(payload);
      if (error) alert('Error al crear: ' + error.message);
      else this.cancelarEdicionRecompensa();
    }
    await this.cargarDatos();
  }

  editarRecompensa(rec: any) {
    this.idRecompensaEditando.set(rec.id);
    this.archivoRecompensaSeleccionado = null;
    this.nuevaRecompensa.set({ ...rec, imagen_url: rec.imagen_url || '' });
  }

  cancelarEdicionRecompensa() {
    this.idRecompensaEditando.set(null);
    this.archivoRecompensaSeleccionado = null;
    if (this.fileInputRecompensa && this.fileInputRecompensa.nativeElement) {
      this.fileInputRecompensa.nativeElement.value = '';
    }
    this.nuevaRecompensa.set({ nombre: '', descripcion: '', costo_puntos: 100, tipo: 'Entrada', imagen_url: '', activo: true });
  }

  async eliminarRecompensa(id: string) {
    if (!confirm('¿Eliminar esta recompensa del catálogo?')) return;
    const { error } = await this.recompensasService.eliminarRecompensa(id);
    if (error) alert('Error al eliminar: ' + error.message);
    else await this.cargarDatos();
  }
}