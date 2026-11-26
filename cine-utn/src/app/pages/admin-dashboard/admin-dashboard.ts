import {
  Component,
  signal,
  computed,
  ViewChild,
  ElementRef,
  inject,
  OnInit,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { SupabaseService } from '../../services/supabase';
import { CandyService } from '../../services/candy';
import { CuponesService } from '../../services/cupones';
import { RecompensasService } from '../../services/recompensas';
import { AuditoriaService } from '../../services/auditoria';
import { ModalService } from '../../services/modal';

export type PestanaAdmin =
  | 'peliculas'
  | 'propuestas'
  | 'candy'
  | 'cupones'
  | 'funciones'
  | 'recompensas'
  | 'roles'
  | 'empleados'
  | 'reportes';

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
  private auditoriaService = inject(AuditoriaService);
  private modalService = inject(ModalService);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInputCandy') fileInputCandy!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInputRecompensa') fileInputRecompensa!: ElementRef<HTMLInputElement>;

  pestanaActiva = signal<PestanaAdmin>('peliculas');

  // Control de Permisos del Usuario Logueado
  esSuperAdmin = signal<boolean>(false);
  permisosUsuario = signal<string[]>([]);

  // Catálogo de secciones configurables para los Roles
  seccionesDisponibles: { id: PestanaAdmin; nombre: string; icono: string }[] = [
    { id: 'peliculas', nombre: 'Películas', icono: 'bi-film' },
    { id: 'propuestas', nombre: 'Películas Sugeridas', icono: 'bi-megaphone-fill' },
    { id: 'candy', nombre: 'Candy Bar', icono: 'bi-cup-straw' },
    { id: 'cupones', nombre: 'Cupones', icono: 'bi-ticket-perforated' },
    { id: 'funciones', nombre: 'Funciones & Salas', icono: 'bi-calendar-event' },
    { id: 'recompensas', nombre: 'Fidelización', icono: 'bi-star-fill' },
    { id: 'roles', nombre: 'Roles y Permisos', icono: 'bi-shield-lock' },
    { id: 'empleados', nombre: 'Empleados', icono: 'bi-people-fill' },
    { id: 'reportes', nombre: 'Reportes & Logs', icono: 'bi-graph-up-arrow' },
  ];

  // Listas de datos
  peliculas = signal<any[]>([]);
  propuestasClientes = signal<any[]>([]);
  productosCandy = signal<any[]>([]);
  cupones = signal<any[]>([]);
  funciones = signal<any[]>([]);
  salas = signal<any[]>([]);
  recompensas = signal<any[]>([]);
  conteoEsperaPorFuncion = signal<Record<string, number>>({});

  propuestasPendientesCount = computed(
    () => this.propuestasClientes().filter((p) => p.estado === 'pendiente').length
  );

  // Datos de Roles y Empleados
  rolesAdmin = signal<any[]>([]);
  empleadosSistema = signal<any[]>([]);
  filtroEmpleado = signal<string>('');
  rolSeleccionadoPorEmpleado = signal<Record<string, string>>({});
  creandoEmpleado = signal<boolean>(false);

  nuevoEmpleado = signal<{
    nombre: string;
    apellido: string;
    fecha_nacimiento: string;
    correo: string;
    password: string;
    rol_admin_id: string;
  }>({
    nombre: '',
    apellido: '',
    fecha_nacimiento: '',
    correo: '',
    password: '',
    rol_admin_id: '',
  });

  empleadosFiltrados = computed(() => {
    const termino = this.filtroEmpleado().trim().toLowerCase();
    const lista = this.empleadosSistema();
    if (!termino) return lista;

    return lista.filter((e) => {
      const nombreCompleto = `${e.nombre || ''} ${e.apellido || ''}`.toLowerCase();
      const correo = (e.correo || '').toLowerCase();
      return nombreCompleto.includes(termino) || correo.includes(termino);
    });
  });

  // Estados de carga y edición
  subiendoImagen = signal<boolean>(false);
  idPeliculaEditando = signal<string | null>(null);
  idCandyEditando = signal<string | null>(null);
  idCuponEditando = signal<string | null>(null);
  idFuncionEditando = signal<string | null>(null);
  idRecompensaEditando = signal<string | null>(null);
  idRolEditando = signal<string | null>(null);

  // Archivos seleccionados
  archivoPosterSeleccionado: File | null = null;
  archivoCandySeleccionado: File | null = null;
  archivoRecompensaSeleccionado: File | null = null;

  // Géneros disponibles
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

  // Formulario Película
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
    precio_preventa: 0,
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
    activo: true,
  });

  // Formulario Roles Configurables
  nuevoRol = signal<{ nombre: string; descripcion: string; permisos: PestanaAdmin[] }>({
    nombre: '',
    descripcion: '',
    permisos: [],
  });

  // Programación Recurrente
  periodoRecurrencia: number = 1;
  diasSemana = [
    { id: 1, nombre: 'Lun', seleccionado: false },
    { id: 2, nombre: 'Mar', seleccionado: false },
    { id: 3, nombre: 'Mié', seleccionado: false },
    { id: 4, nombre: 'Jue', seleccionado: false },
    { id: 5, nombre: 'Vie', seleccionado: false },
    { id: 6, nombre: 'Sáb', seleccionado: false },
    { id: 0, nombre: 'Dom', seleccionado: false },
  ];

  // Métricas y Reportes
  logsAuditoria = signal<any[]>([]);
  metrasDashboard = signal({
    recaudacionTotal: 0,
    entradasVendidas: 0,
    productosCandyVendidos: 0,
    porcentajeOcupacion: 0,
  });

  async ngOnInit() {
    const perfil = await this.authService.getPerfilActual();

    if (!this.authService.tienePermisoAdmin(perfil)) {
      await this.modalService.alerta(
        'Acceso restringido únicamente para personal autorizado de administración.',
        'Acceso Denegado',
        'danger'
      );
      this.router.navigate(['/login-staff']);
      return;
    }

    const superAdmin = (perfil.rol === 'admin' || perfil.rol === 'gerente') && !perfil.rol_admin_id;
    const permisos: string[] = superAdmin
      ? this.seccionesDisponibles.map((s) => s.id)
      : perfil.roles_admin?.permisos || [];

    this.esSuperAdmin.set(superAdmin);
    this.permisosUsuario.set(permisos);

    const primeraHabilitada = this.seccionesDisponibles.find((s) => permisos.includes(s.id));
    if (primeraHabilitada) {
      this.pestanaActiva.set(primeraHabilitada.id);
    }

    await this.cargarDatos();
    await this.cargarSalas();

    if (this.puedeVerPestana('roles') || this.puedeVerPestana('empleados')) {
      await this.cargarRolesYEmpleados();
    }
    if (this.pestanaActiva() === 'reportes') {
      await this.cargarMetricasYLogs();
    }
  }

  puedeVerPestana(seccion: PestanaAdmin): boolean {
    return this.esSuperAdmin() || this.permisosUsuario().includes(seccion);
  }

  async cargarDatos() {
    const hoy = new Date().toISOString();

    const [resPelis, resPropuestas, resCandy, resCups, resFuncs, resRecompensas, resEspera] = await Promise.all([
      this.supabaseService.client.from('peliculas').select('*').eq('activa', true),
      this.supabaseService.client
        .from('propuestas_peliculas')
        .select('*')
        .order('created_at', { ascending: false }),
      this.candyService.getProductos(),
      this.cuponesService.getCupones(),
      this.supabaseService.client
        .from('funciones')
        .select('*, peliculas(titulo, duracion_minutos), salas(nombre)')
        .neq('estado', 'cancelada')
        .gte('horario_fin', hoy)
        .order('fecha_hora', { ascending: true }),
      this.recompensasService.getRecompensas(),
      this.supabaseService.client
        .from('lista_espera')
        .select('funcion_id')
        .in('estado', ['esperando', 'notificado']),
    ]);

    if (resPelis.data) this.peliculas.set(resPelis.data);
    if (resPropuestas.data) this.propuestasClientes.set(resPropuestas.data);
    if (resCandy.data) this.productosCandy.set(resCandy.data);
    if (resCups.data) this.cupones.set(resCups.data);
    if (resFuncs.data) this.funciones.set(resFuncs.data);
    if (resRecompensas.data) this.recompensas.set(resRecompensas.data);

    const mapaEspera: Record<string, number> = {};
    if (resEspera.data) {
      resEspera.data.forEach((e: any) => {
        if (e.funcion_id) {
          mapaEspera[e.funcion_id] = (mapaEspera[e.funcion_id] || 0) + 1;
        }
      });
    }
    this.conteoEsperaPorFuncion.set(mapaEspera);
  }

  obtenerCantidadEnEspera(funcionId: string): number {
    return this.conteoEsperaPorFuncion()[funcionId] || 0;
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

  // --- GESTIÓN DE PELÍCULAS SUGERIDAS POR CLIENTES ---
  async aceptarPropuestaCliente(prop: any) {
    const { error } = await this.supabaseService.client
      .from('propuestas_peliculas')
      .update({ estado: 'aprobada' })
      .eq('id', prop.id);

    if (error) {
      await this.modalService.alerta('Error al aceptar sugerencia: ' + error.message, 'Error', 'danger');
      return;
    }

    if (prop.usuario_id) {
      await this.supabaseService.client.from('notificaciones').insert([
        {
          usuario_id: prop.usuario_id,
          titulo: '🎬 ¡Tu sugerencia de película fue aceptada!',
          mensaje: `Gerencia aceptó tu pedido de "${prop.titulo}" para incorporarla próximamente a Cine UTN.`,
          tipo: 'propuesta_aprobada',
        },
      ]);
    }

    await this.auditoriaService.registrarAccion('ACEPTAR_PELICULA_SUGERIDA', {
      id: prop.id,
      titulo: prop.titulo,
      solicitante: prop.nombre_usuario,
    });

    // Precargar título y comentario en el alta de Películas como Próximamente
    this.idPeliculaEditando.set(null);
    this.archivoPosterSeleccionado = null;
    this.generosSeleccionados.set([]);
    this.nuevaPelicula.set({
      titulo: prop.titulo,
      sinopsis: prop.comentario || '',
      genero: '',
      duracion_minutos: 120,
      clasificacion: 'ATP',
      poster_url: '',
      es_proximamente: true,
      fecha_estreno: '',
      es_preventa: false,
      precio_preventa: 0,
    });

    await this.cargarDatos();
    this.pestanaActiva.set('peliculas');

    await this.modalService.alerta(
      `La sugerencia "${prop.titulo}" fue aceptada y notificada al cliente. Completá los datos del estreno para publicarla.`,
      'Sugerencia Aceptada',
      'success'
    );
  }

  async denegarPropuestaCliente(prop: any) {
    const confirmado = await this.modalService.confirmar(
      `¿Denegar la solicitud de "${prop.titulo}" enviada por ${prop.nombre_usuario}?`,
      'Denegar Sugerencia',
      'Denegar',
      'Volver'
    );
    if (!confirmado) return;

    const { error } = await this.supabaseService.client
      .from('propuestas_peliculas')
      .update({ estado: 'rechazada' })
      .eq('id', prop.id);

    if (error) {
      await this.modalService.alerta('Error al denegar sugerencia: ' + error.message, 'Error', 'danger');
      return;
    }

    await this.auditoriaService.registrarAccion('DENEGAR_PELICULA_SUGERIDA', {
      id: prop.id,
      titulo: prop.titulo,
      solicitante: prop.nombre_usuario,
    });

    await this.cargarDatos();
    await this.modalService.alerta('La solicitud fue denegada.', 'Solicitud Denegada', 'info');
  }

  // --- GESTIÓN DE ROLES Y EMPLEADOS ---
  async cargarRolesYEmpleados() {
    const [resRoles, resEmpleados] = await Promise.all([
      this.supabaseService.client
        .from('roles_admin')
        .select('*')
        .order('created_at', { ascending: true }),
      this.supabaseService.client
        .from('perfiles')
        .select(
          'id, nombre, apellido, correo, fecha_nacimiento, rol, activo, rol_admin_id, roles_admin(id, nombre, permisos)'
        )
        .in('rol', ['empleado', 'gerente', 'admin'])
        .order('created_at', { ascending: false }),
    ]);

    if (resRoles.data) {
      this.rolesAdmin.set(resRoles.data);
    }

    if (resEmpleados.data) {
      this.empleadosSistema.set(resEmpleados.data);
      const mapaSeleccion: Record<string, string> = {};
      resEmpleados.data.forEach((emp: any) => {
        mapaSeleccion[emp.id] = emp.rol_admin_id || '';
      });
      this.rolSeleccionadoPorEmpleado.set(mapaSeleccion);
    }
  }

  async darDeAltaEmpleado() {
    const emp = { ...this.nuevoEmpleado() };

    if (!emp.nombre.trim() || !emp.apellido.trim()) {
      await this.modalService.alerta('Completá el nombre y el apellido del empleado.', 'Datos Incompletos', 'warning');
      return;
    }
    if (!emp.correo.trim() || !emp.correo.includes('@')) {
      await this.modalService.alerta('Ingresá un correo electrónico válido.', 'Correo Inválido', 'warning');
      return;
    }
    if (!emp.password || emp.password.length < 6) {
      await this.modalService.alerta(
        'La contraseña provisoria debe tener al menos 6 caracteres.',
        'Contraseña Corta',
        'warning'
      );
      return;
    }

    try {
      this.creandoEmpleado.set(true);

      await this.authService.registrarEmpleadoDesdeAdmin({
        email: emp.correo,
        password: emp.password,
        nombre: emp.nombre,
        apellido: emp.apellido,
        fechaNacimiento: emp.fecha_nacimiento || undefined,
        rolAdminId: emp.rol_admin_id || null,
      });

      const rolObj = this.rolesAdmin().find((r) => r.id === emp.rol_admin_id);

      await this.auditoriaService.registrarAccion('ALTA_EMPLEADO', {
        empleado_email: emp.correo.trim().toLowerCase(),
        nombre_completo: `${emp.nombre.trim()} ${emp.apellido.trim()}`,
        rol_asignado: rolObj?.nombre || 'Empleado Operativo (Sin permisos admin)',
      });

      this.nuevoEmpleado.set({
        nombre: '',
        apellido: '',
        fecha_nacimiento: '',
        correo: '',
        password: '',
        rol_admin_id: '',
      });

      await this.modalService.alerta('Empleado registrado correctamente.', 'Alta Exitosa', 'success');
      await this.cargarRolesYEmpleados();
    } catch (err: any) {
      await this.modalService.alerta(
        'Error al registrar empleado: ' + (err.message || 'Ocurrió un error inesperado.'),
        'Error',
        'danger'
      );
    } finally {
      this.creandoEmpleado.set(false);
    }
  }

  togglePermisoRol(seccionId: PestanaAdmin) {
    const actual = { ...this.nuevoRol() };
    const permisos = [...actual.permisos];
    const idx = permisos.indexOf(seccionId);

    if (idx > -1) {
      permisos.splice(idx, 1);
    } else {
      permisos.push(seccionId);
    }

    this.nuevoRol.set({ ...actual, permisos });
  }

  obtenerNombreSeccion(id: string): string {
    return this.seccionesDisponibles.find((s) => s.id === id)?.nombre || id;
  }

  async guardarRol() {
    const rolData = { ...this.nuevoRol() };
    if (!rolData.nombre.trim()) {
      await this.modalService.alerta('Ingresá un nombre para el rol.', 'Campo Requerido', 'warning');
      return;
    }
    if (rolData.permisos.length === 0) {
      await this.modalService.alerta(
        'Seleccioná al menos una sección habilitada para este rol.',
        'Sin Permisos',
        'warning'
      );
      return;
    }

    const payload = {
      nombre: rolData.nombre.trim(),
      descripcion: rolData.descripcion.trim() || null,
      permisos: rolData.permisos,
    };

    if (this.idRolEditando()) {
      const { error } = await this.supabaseService.client
        .from('roles_admin')
        .update(payload)
        .eq('id', this.idRolEditando());

      if (error) {
        await this.modalService.alerta('Error al actualizar el rol: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('MODIFICAR_ROL_ADMIN', {
          id: this.idRolEditando(),
          nombre: payload.nombre,
          permisos: payload.permisos,
        });
        this.cancelarEdicionRol();
      }
    } else {
      const { error } = await this.supabaseService.client.from('roles_admin').insert([payload]);

      if (error) {
        await this.modalService.alerta('Error al crear el rol: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('CREAR_ROL_ADMIN', {
          nombre: payload.nombre,
          permisos: payload.permisos,
        });
        this.cancelarEdicionRol();
      }
    }

    await this.cargarRolesYEmpleados();
  }

  editarRol(rol: any) {
    this.idRolEditando.set(rol.id);
    this.nuevoRol.set({
      nombre: rol.nombre,
      descripcion: rol.descripcion || '',
      permisos: [...(rol.permisos || [])],
    });
  }

  cancelarEdicionRol() {
    this.idRolEditando.set(null);
    this.nuevoRol.set({
      nombre: '',
      descripcion: '',
      permisos: [],
    });
  }

  async eliminarRol(rol: any) {
    const ok = await this.modalService.confirmar(
      `¿Eliminar el rol "${rol.nombre}"? Los empleados con este rol perderán sus permisos asignados.`,
      'Eliminar Rol'
    );
    if (!ok) return;

    const { error } = await this.supabaseService.client.from('roles_admin').delete().eq('id', rol.id);

    if (error) {
      await this.modalService.alerta('Error al eliminar el rol: ' + error.message, 'Error', 'danger');
    } else {
      await this.auditoriaService.registrarAccion('ELIMINAR_ROL_ADMIN', { id: rol.id, nombre: rol.nombre });
      await this.cargarRolesYEmpleados();
    }
  }

  actualizarSeleccionRolEmpleado(empleadoId: string, rolId: string) {
    this.rolSeleccionadoPorEmpleado.update((prev) => ({
      ...prev,
      [empleadoId]: rolId,
    }));
  }

  async asignarRolAEmpleado(empleado: any) {
    const rolId = this.rolSeleccionadoPorEmpleado()[empleado.id];
    if (!rolId) {
      await this.modalService.alerta('Seleccioná un rol del desplegable antes de asignar.', 'Atención', 'warning');
      return;
    }

    const rolObj = this.rolesAdmin().find((r) => r.id === rolId);

    const { error } = await this.supabaseService.client
      .from('perfiles')
      .update({ rol_admin_id: rolId })
      .eq('id', empleado.id);

    if (error) {
      await this.modalService.alerta('Error al asignar el rol: ' + error.message, 'Error', 'danger');
    } else {
      await this.auditoriaService.registrarAccion('ASIGNAR_ROL_EMPLEADO', {
        empleado_email: empleado.correo,
        rol_asignado: rolObj?.nombre || rolId,
      });
      await this.cargarRolesYEmpleados();
    }
  }

  async quitarRolAEmpleado(empleado: any) {
    const ok = await this.modalService.confirmar(
      `¿Quitar los permisos administrativos asignados a ${empleado.correo}?`,
      'Quitar Permisos'
    );
    if (!ok) return;

    const { error } = await this.supabaseService.client
      .from('perfiles')
      .update({ rol_admin_id: null })
      .eq('id', empleado.id);

    if (error) {
      await this.modalService.alerta('Error al quitar el rol: ' + error.message, 'Error', 'danger');
    } else {
      await this.auditoriaService.registrarAccion('QUITAR_ROL_EMPLEADO', {
        empleado_email: empleado.correo,
      });
      await this.cargarRolesYEmpleados();
    }
  }

  async toggleEstadoEmpleado(empleado: any) {
    const nuevoEstado = empleado.activo === false ? true : false;
    const accionTexto = nuevoEstado ? 'habilitar' : 'deshabilitar';

    const ok = await this.modalService.confirmar(
      `¿Deseás ${accionTexto} el acceso de ${empleado.nombre || empleado.correo}?`,
      nuevoEstado ? 'Habilitar Acceso' : 'Deshabilitar Acceso'
    );
    if (!ok) return;

    const { error } = await this.supabaseService.client
      .from('perfiles')
      .update({ activo: nuevoEstado })
      .eq('id', empleado.id);

    if (error) {
      await this.modalService.alerta('Error al cambiar estado: ' + error.message, 'Error', 'danger');
    } else {
      await this.auditoriaService.registrarAccion(
        nuevoEstado ? 'HABILITAR_EMPLEADO' : 'DESHABILITAR_EMPLEADO',
        { empleado_email: empleado.correo }
      );
      await this.cargarRolesYEmpleados();
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

  // --- MANEJO DE GÉNEROS Y ESTADOS PRÓXIMAMENTE / PREVENTA ---
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

  onToggleProximamente(valor: boolean) {
    const actual = { ...this.nuevaPelicula() };
    actual.es_proximamente = valor;
    // Si deja de ser Próximamente, tampoco puede ser Preventa
    if (!valor) {
      actual.es_preventa = false;
      actual.precio_preventa = 0;
    }
    this.nuevaPelicula.set(actual);
  }

  onTogglePreventa(valor: boolean) {
    const actual = { ...this.nuevaPelicula() };
    actual.es_preventa = valor;
    // Si es Preventa, por definición también es Próximamente
    if (valor) {
      actual.es_proximamente = true;
    }
    this.nuevaPelicula.set(actual);
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
        await this.modalService.alerta('Error al subir imagen a Storage: ' + uploadError.message, 'Error', 'danger');
        return null;
      }

      const { data } = this.supabaseService.client.storage.from('posters').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      await this.modalService.alerta('Error inesperado subiendo la imagen.', 'Error', 'danger');
      return null;
    } finally {
      this.subiendoImagen.set(false);
    }
  }

  // --- CRUD PELÍCULAS ---
  async guardarPelicula() {
    const peli = { ...this.nuevaPelicula() };
    if (!peli.titulo?.trim()) {
      await this.modalService.alerta('Completá el título de la película.', 'Campo Requerido', 'warning');
      return;
    }

    const listaGeneros = this.generosSeleccionados();
    if (listaGeneros.length === 0) {
      await this.modalService.alerta('Seleccioná al menos un género.', 'Campo Requerido', 'warning');
      return;
    }

    let urlImagen = peli.poster_url;

    if (this.archivoPosterSeleccionado) {
      const urlSubida = await this.subirPosterASupabase(this.archivoPosterSeleccionado);
      if (urlSubida) {
        urlImagen = urlSubida;
      } else {
        return;
      }
    }

    const esPreventaFinal = Boolean(peli.es_preventa);
    const esProximamenteFinal = esPreventaFinal ? true : Boolean(peli.es_proximamente);

    const payload = {
      titulo: peli.titulo.trim(),
      sinopsis: peli.sinopsis,
      duracion_minutos: peli.duracion_minutos,
      imagen_url: urlImagen,
      clasificacion_edad: peli.clasificacion,
      generos: listaGeneros,
      es_proximamente: esProximamenteFinal,
      fecha_estreno: peli.fecha_estreno || null,
      es_preventa: esPreventaFinal,
      precio_preventa: esPreventaFinal ? Number(peli.precio_preventa) || 0 : 0,
    };

    if (this.idPeliculaEditando()) {
      const { error } = await this.supabaseService.client
        .from('peliculas')
        .update(payload)
        .eq('id', this.idPeliculaEditando());

      if (error) {
        await this.modalService.alerta('Error al actualizar: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('MODIFICAR_PELICULA', {
          id: this.idPeliculaEditando(),
          titulo: payload.titulo,
        });
        this.resetFormPelicula();
      }
    } else {
      const { error } = await this.supabaseService.client.from('peliculas').insert([payload]);

      if (error) {
        await this.modalService.alerta('Error al crear: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('CREAR_PELICULA', { titulo: payload.titulo });
        this.resetFormPelicula();
      }
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

    const esPreventa = Boolean(peli.es_preventa);
    this.nuevaPelicula.set({
      titulo: peli.titulo,
      sinopsis: peli.sinopsis || '',
      genero: '',
      duracion_minutos: peli.duracion_minutos,
      clasificacion: peli.clasificacion_edad || 'ATP',
      poster_url: peli.imagen_url || '',
      es_proximamente: esPreventa ? true : Boolean(peli.es_proximamente),
      fecha_estreno: peli.fecha_estreno || '',
      es_preventa: esPreventa,
      precio_preventa: Number(peli.precio_preventa) || 0,
    });
  }

  async eliminarPelicula(id: string) {
    const ok = await this.modalService.confirmar(
      '¿Seguro que deseas quitar esta película de la cartelera? Se conservará en el historial de ventas y de clientes.',
      'Quitar Película'
    );
    if (!ok) return;

    const peliEliminada = this.peliculas().find((p) => p.id === id);
    const { error } = await this.supabaseService.client
      .from('peliculas')
      .update({ activa: false })
      .eq('id', id);

    if (error) {
      await this.modalService.alerta('Error al dar de baja la película: ' + error.message, 'Error', 'danger');
    } else {
      await this.auditoriaService.registrarAccion('BAJA_LOGICA_PELICULA', {
        id,
        titulo: peliEliminada?.titulo || 'Desconocido',
      });
      await this.cargarDatos();
    }
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
      es_proximamente: false,
      fecha_estreno: '',
      es_preventa: false,
      precio_preventa: 0,
    });
  }

  cancelarEdicionPelicula() {
    this.resetFormPelicula();
  }

  // --- CRUD CANDY BAR ---
  async guardarCandy() {
    const prod = { ...this.nuevoCandy() };

    if (!prod.nombre?.trim()) {
      await this.modalService.alerta('Completá el nombre del producto.', 'Campo Requerido', 'warning');
      return;
    }
    if (prod.precio <= 0 || prod.precio > 999999) {
      await this.modalService.alerta(
        'El precio debe ser mayor a $0 y menor a $999.999.',
        'Precio Inválido',
        'warning'
      );
      return;
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
      if (error) {
        await this.modalService.alerta('Error al actualizar: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('MODIFICAR_PRODUCTO_CANDY', {
          id: this.idCandyEditando(),
          nombre: prod.nombre,
          precio: prod.precio,
        });
        this.cancelarEdicionCandy();
      }
    } else {
      const { error } = await this.candyService.crearProducto(prod);
      if (error) {
        await this.modalService.alerta('Error al crear: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('CREAR_PRODUCTO_CANDY', {
          nombre: prod.nombre,
          precio: prod.precio,
        });
        this.cancelarEdicionCandy();
      }
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
      imagen_url: prod.imagen_url || '',
    });
  }

  async eliminarCandy(id: string) {
    const ok = await this.modalService.confirmar(
      '¿Quitar este producto del catálogo de Candy Bar?',
      'Eliminar Producto'
    );
    if (!ok) return;

    const candyEliminado = this.productosCandy().find((c) => c.id === id);
    const { error } = await this.candyService.eliminarProducto(id);
    if (error) {
      await this.modalService.alerta('Error al eliminar: ' + error.message, 'Error', 'danger');
    } else {
      await this.auditoriaService.registrarAccion('ELIMINAR_PRODUCTO_CANDY', {
        id,
        nombre: candyEliminado?.nombre || 'Desconocido',
      });
      await this.cargarDatos();
    }
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
        await this.modalService.alerta('Error al subir imagen a Storage: ' + uploadError.message, 'Error', 'danger');
        return null;
      }

      const { data } = this.supabaseService.client.storage.from('posters').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      await this.modalService.alerta('Error inesperado subiendo la imagen.', 'Error', 'danger');
      return null;
    } finally {
      this.subiendoImagen.set(false);
    }
  }

  // --- CRUD CUPONES ---
  async guardarCupon() {
    const cup = { ...this.nuevoCupon() };
    if (!cup.codigo || cup.porcentaje_descuento <= 0 || cup.porcentaje_descuento > 100) {
      await this.modalService.alerta(
        'Por favor, ingresá un código y un descuento válido entre 1 y 100.',
        'Datos Inválidos',
        'warning'
      );
      return;
    }

    cup.codigo = cup.codigo.toUpperCase().trim();

    if (this.idCuponEditando()) {
      const { error } = await this.cuponesService.actualizarCupon(this.idCuponEditando()!, cup);
      if (error) {
        await this.modalService.alerta('Error al actualizar: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('MODIFICAR_CUPON', {
          id: this.idCuponEditando(),
          codigo: cup.codigo,
          descuento: cup.porcentaje_descuento,
        });
        this.idCuponEditando.set(null);
      }
    } else {
      const { error } = await this.cuponesService.crearCupon(cup);
      if (error) {
        await this.modalService.alerta('Error al crear: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('CREAR_CUPON', {
          codigo: cup.codigo,
          descuento: cup.porcentaje_descuento,
        });
      }
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
    const ok = await this.modalService.confirmar('¿Eliminar este cupón de descuento?', 'Eliminar Cupón');
    if (!ok) return;

    const cupEliminado = this.cupones().find((c) => c.id === id);
    const { error } = await this.cuponesService.eliminarCupon(id);
    if (error) {
      await this.modalService.alerta('Error al eliminar: ' + error.message, 'Error', 'danger');
    } else {
      await this.auditoriaService.registrarAccion('ELIMINAR_CUPON', {
        id,
        codigo: cupEliminado?.codigo || 'Desconocido',
      });
      await this.cargarDatos();
    }
  }

  // --- PROGRAMACIÓN DE FUNCIONES CON RECURRENCIA ---
  hayDiasSeleccionados(): boolean {
    return this.diasSemana.some((d) => d.seleccionado);
  }

  resetearDiasSemana() {
    this.diasSemana.forEach((d) => (d.seleccionado = false));
    this.periodoRecurrencia = 1;
  }

  async crearFuncionAutomatica() {
    const fn = { ...this.nuevaFuncion() };

    if (!fn.pelicula_id || !fn.fecha_hora || !fn.sala_id) {
      await this.modalService.alerta(
        'Por favor seleccioná Película, Sala y Fecha/Hora.',
        'Campos Requeridos',
        'warning'
      );
      return;
    }

    const fechaInicioBase = new Date(fn.fecha_hora);
    const ahora = new Date();

    if (fechaInicioBase < ahora && !this.idFuncionEditando()) {
      await this.modalService.alerta(
        'No podés programar una nueva función en un horario pasado.',
        'Horario Inválido',
        'warning'
      );
      return;
    }

    const peliElegida = this.peliculas().find((p) => p.id === fn.pelicula_id);
    const duracionMinutos = peliElegida?.duracion_minutos || 120;

    // Tarifa dinámica según Preventa y Formato (2D / 3D)
    const tarifaBase =
      peliElegida?.es_preventa && Number(peliElegida?.precio_preventa) > 0
        ? Number(peliElegida.precio_preventa)
        : 4500;
    const precioFinalFuncion = fn.formato === '3D' ? Math.round(tarifaBase * 1.2) : tarifaBase;

    const diasElegidos = this.diasSemana.filter((d) => d.seleccionado).map((d) => d.id);
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
      const fechaFinConLimpieza = new Date(fechaInicio.getTime() + (duracionMinutos + 30) * 60000);

      const haySolapamiento = funcionesExistentes.some((existente) => {
        if (this.idFuncionEditando() && existente.id === this.idFuncionEditando()) return false;
        if (existente.sala_id !== fn.sala_id) return false;

        const inicioExistente = new Date(existente.fecha_hora || existente.horario_inicio);
        const duracionExistente = existente.peliculas?.duracion_minutos || 120;
        const finExistenteConLimpieza = new Date(
          inicioExistente.getTime() + (duracionExistente + 30) * 60000
        );

        return fechaInicio < finExistenteConLimpieza && fechaFinConLimpieza > inicioExistente;
      });

      if (haySolapamiento) {
        omitidasPorSolapamiento++;
      } else {
        const payload = {
          pelicula_id: fn.pelicula_id,
          sala_id: fn.sala_id,
          fecha_hora: fechaInicio.toISOString(),
          horario_inicio: fechaInicio.toISOString(),
          horario_fin: new Date(fechaInicio.getTime() + duracionMinutos * 60000).toISOString(),
          formato: fn.formato,
          idioma: fn.idioma,
          precio_base: precioFinalFuncion,
        };
        nuevasFuncionesPayload.push(payload);
        funcionesExistentes.push({
          ...payload,
          peliculas: { duracion_minutos: duracionMinutos },
        });
      }
    }

    if (nuevasFuncionesPayload.length === 0) {
      await this.modalService.alerta(
        'La sala seleccionada está ocupada en ese horario o no se respeta el margen obligatorio de 30 minutos de limpieza entre funciones.',
        'Conflicto de Sala',
        'warning'
      );
      return;
    }

    if (this.idFuncionEditando()) {
      const { error } = await this.supabaseService.client
        .from('funciones')
        .update(nuevasFuncionesPayload[0])
        .eq('id', this.idFuncionEditando());

      if (error) {
        await this.modalService.alerta('Error al actualizar: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('MODIFICAR_FUNCION', {
          id: this.idFuncionEditando(),
          pelicula: peliElegida?.titulo,
          fecha: nuevasFuncionesPayload[0].fecha_hora,
          formato: fn.formato,
          precio_base: precioFinalFuncion,
        });
        this.cancelarEdicionFuncion();
      }
    } else {
      const { error } = await this.supabaseService.client
        .from('funciones')
        .insert(nuevasFuncionesPayload);

      if (error) {
        await this.modalService.alerta('Error al programar: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('PROGRAMAR_FUNCION', {
          pelicula: peliElegida?.titulo,
          cantidad_programada: nuevasFuncionesPayload.length,
          formato: fn.formato,
          precio_base: precioFinalFuncion,
        });
        let msg = `Se programó ${nuevasFuncionesPayload.length} función(es) con éxito (Tarifa aplicada: $${precioFinalFuncion}).`;
        if (omitidasPorSolapamiento > 0) {
          msg += `\n⚠️ ${omitidasPorSolapamiento} fecha(s) omitida(s) por superposición.`;
        }
        await this.modalService.alerta(msg, 'Programación Exitosa', 'success');
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
      const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
      fechaFormateada = localDate.toISOString().slice(0, 16);
    }

    this.idFuncionEditando.set(func.id);
    this.nuevaFuncion.set({
      pelicula_id: func.pelicula_id,
      sala_id: func.sala_id,
      fecha_hora: fechaFormateada,
      formato: func.formato || '2D',
      idioma: func.idioma || 'Castellano',
    });
  }

  async eliminarFuncion(id: string) {
    const funcEliminada = this.funciones().find((f) => f.id === id);
    const motivo = await this.modalService.pedirTexto(
      'Se devolverá el 100% del dinero como crédito a favor a todos los clientes con entradas, se revertirán los puntos correspondientes y se les enviará una alerta.\n\nIngresá el motivo de la cancelación:',
      'Cancelar Función de Forma Atómica',
      'Motivos operativos / técnicos de sala',
      'Motivo de cancelación...'
    );

    if (motivo === null) return;

    try {
      const { data, error } = await this.supabaseService.client.rpc('cancelar_funcion_atomica', {
        p_funcion_id: id,
        p_motivo: motivo.trim() || 'Motivos operativos de sala',
      });

      if (error) throw error;

      await this.auditoriaService.registrarAccion('CANCELAR_FUNCION_ATOMICA', {
        id,
        pelicula: funcEliminada?.peliculas?.titulo,
        fecha: funcEliminada?.fecha_hora,
        motivo: motivo.trim() || 'Motivos operativos de sala',
        ventas_canceladas: data?.ventas_canceladas || 0,
        total_reembolsado: data?.total_reembolsado || 0,
      });

      await this.modalService.alerta(
        `Entradas reembolsadas: ${data?.ventas_canceladas || 0}\nTotal acreditado a clientes: $${data?.total_reembolsado || 0}`,
        'Función Cancelada de Forma Atómica',
        'success'
      );

      await this.cargarDatos();
    } catch (err: any) {
      console.error('Error al cancelar función:', err);
      await this.modalService.alerta(
        'Error al cancelar función: ' + (err.message || 'Ocurrió un error inesperado.'),
        'Error',
        'danger'
      );
    }
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

      const { error: uploadError } = await this.supabaseService.client.storage
        .from('posters')
        .upload(filePath, file);
      if (uploadError) {
        await this.modalService.alerta('Error al subir imagen: ' + uploadError.message, 'Error', 'danger');
        return null;
      }
      const { data } = this.supabaseService.client.storage.from('posters').getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      await this.modalService.alerta('Error inesperado subiendo la imagen.', 'Error', 'danger');
      return null;
    } finally {
      this.subiendoImagen.set(false);
    }
  }

  async guardarRecompensa() {
    const rec = { ...this.nuevaRecompensa() };
    if (!rec.nombre?.trim() || rec.costo_puntos <= 0) {
      await this.modalService.alerta('Completá nombre y un costo válido en puntos.', 'Campo Requerido', 'warning');
      return;
    }

    let urlImagen = rec.imagen_url;
    if (this.archivoRecompensaSeleccionado) {
      const urlSubida = await this.subirImagenRecompensa(this.archivoRecompensaSeleccionado);
      if (urlSubida) urlImagen = urlSubida;
      else return;
    }

    const payload = {
      nombre: rec.nombre.trim(),
      descripcion: rec.descripcion || null,
      costo_puntos: Number(rec.costo_puntos),
      tipo: rec.tipo,
      imagen_url: urlImagen || null,
      activo: rec.activo !== undefined ? rec.activo : true,
    };

    if (this.idRecompensaEditando()) {
      const { error } = await this.recompensasService.actualizarRecompensa(
        this.idRecompensaEditando()!,
        payload
      );
      if (error) {
        await this.modalService.alerta('Error al actualizar: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('MODIFICAR_RECOMPENSA', {
          id: this.idRecompensaEditando(),
          nombre: payload.nombre,
          costo: payload.costo_puntos,
        });
        this.cancelarEdicionRecompensa();
      }
    } else {
      const { error } = await this.recompensasService.crearRecompensa(payload);
      if (error) {
        await this.modalService.alerta('Error al crear: ' + error.message, 'Error', 'danger');
      } else {
        await this.auditoriaService.registrarAccion('CREAR_RECOMPENSA', {
          nombre: payload.nombre,
          costo: payload.costo_puntos,
        });
        this.cancelarEdicionRecompensa();
      }
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
    this.nuevaRecompensa.set({
      nombre: '',
      descripcion: '',
      costo_puntos: 100,
      tipo: 'Entrada',
      imagen_url: '',
      activo: true,
    });
  }

  async eliminarRecompensa(id: string) {
    const ok = await this.modalService.confirmar(
      '¿Eliminar esta recompensa del catálogo?',
      'Eliminar Recompensa'
    );
    if (!ok) return;

    const recEliminada = this.recompensas().find((r) => r.id === id);
    const { error } = await this.recompensasService.eliminarRecompensa(id);
    if (error) {
      await this.modalService.alerta('Error al eliminar: ' + error.message, 'Error', 'danger');
    } else {
      await this.auditoriaService.registrarAccion('ELIMINAR_RECOMPENSA', {
        id,
        nombre: recEliminada?.nombre || 'Desconocido',
      });
      await this.cargarDatos();
    }
  }

  async cargarMetricasYLogs() {
    const { data: ventas } = await this.supabaseService.client.from('ventas').select('*');
    const { data: logs } = await this.auditoriaService.obtenerLogs();

    if (logs) this.logsAuditoria.set(logs);

    if (ventas) {
      let totalDinero = 0;
      let totalEntradas = 0;
      let totalCandy = 0;

      ventas.forEach((v: any) => {
        if (v.estado_qr !== 'cancelado') {
          totalDinero += Number(v.monto_total) || 0;
          if (Array.isArray(v.detalle_butacas)) totalEntradas += v.detalle_butacas.length;
          if (Array.isArray(v.detalle_candy))
            totalCandy += v.detalle_candy.reduce((acc: number, c: any) => acc + (c.cantidad || 1), 0);
        }
      });

      this.metrasDashboard.set({
        recaudacionTotal: totalDinero,
        entradasVendidas: totalEntradas,
        productosCandyVendidos: totalCandy,
        porcentajeOcupacion: Math.min(Math.round((totalEntradas / 500) * 100), 100),
      });
    }
  }

  async exportarVentasCSV() {
    const { data: ventasData, error } = await this.supabaseService.client
      .from('ventas')
      .select('*, funciones(*, peliculas(titulo), salas(nombre))')
      .order('created_at', { ascending: false });

    if (error || !ventasData || ventasData.length === 0) {
      await this.modalService.alerta(
        'No hay ventas registradas para exportar o ocurrió un error al consultar.',
        'Sin Datos',
        'info'
      );
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent +=
      'ID Venta,Fecha Compra,Codigo QR,Pelicula,Sala,Horario Funcion,Cantidad Entradas,Butacas,Total Facturado,Descuento,Estado QR\n';

    ventasData.forEach((v: any) => {
      const pelicula = (v.funciones?.peliculas?.titulo || 'N/A').replace(/"/g, '""');
      const sala = (v.funciones?.salas?.nombre || 'Sala 1').replace(/"/g, '""');
      const horario = v.funciones?.fecha_hora
        ? new Date(v.funciones.fecha_hora).toLocaleString('es-AR')
        : 'N/A';
      const cantEntradas = Array.isArray(v.detalle_butacas) ? v.detalle_butacas.length : 0;
      const butacasStr = Array.isArray(v.detalle_butacas)
        ? v.detalle_butacas.map((b: any) => `${b.fila}${b.columna}`).join('; ')
        : '';
      const butacasEscapadas = `"${butacasStr.replace(/"/g, '""')}"`;
      const fechaCompra = v.created_at ? new Date(v.created_at).toLocaleString('es-AR') : 'N/A';

      csvContent += `"${v.id}","${fechaCompra}","${v.codigo_qr}","${pelicula}","${sala}","${horario}",${cantEntradas},${butacasEscapadas},"${v.monto_total || 0}","${v.descuento_aplicado || 0}","${v.estado_qr || 'valido'}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `reporte_ventas_cine_utn_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    await this.auditoriaService.registrarAccion('EXPORTAR_REPORTE_CSV', {
      cantidad_registros: ventasData.length,
    });
    await this.cargarMetricasYLogs();
  }
}