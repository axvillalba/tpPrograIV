import { Component, signal, computed, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';

registerLocaleData(localeEs, 'es');

interface Resena {
  id?: string;
  nombre_usuario?: string;
  calificacion: number;
  comentario: string;
  created_at?: string;
  perfiles?: {
    nombre?: string;
    apellido?: string;
  };
}

@Component({
  selector: 'app-detalle-pelicula',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './detalle-pelicula.html',
  styleUrl: './detalle-pelicula.css'
})
export class DetallePeliculaComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private cdr = inject(ChangeDetectorRef);

  pelicula = signal<any>(null);
  funciones = signal<any[]>([]);
  diasDisponibles = signal<Date[]>([]);
  diaSeleccionadoIso = signal<string>('');
  funcionSeleccionadaId = signal<string | null>(null);
  cargando = signal<boolean>(true);

  resenas = signal<Resena[]>([]);

  promedioCalificacion = computed(() => {
    const list = this.resenas();
    if (list.length === 0) return '0.0';
    const suma = list.reduce((acc, r) => acc + r.calificacion, 0);
    return (suma / list.length).toFixed(1);
  });

  async ngOnInit() {
    this.generarProximosDias();
    const peliculaId = this.route.snapshot.paramMap.get('id');

    if (peliculaId) {
      await Promise.all([
        this.cargarDetallePelicula(peliculaId),
        this.cargarFunciones(peliculaId),
        this.cargarResenas(peliculaId)
      ]);
    }
    
    this.cargando.set(false);
    this.cdr.detectChanges();
  }

  generarProximosDias() {
    const dias: Date[] = [];
    const hoy = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date();
      d.setDate(hoy.getDate() + i);
      dias.push(d);
    }
    this.diasDisponibles.set(dias);
    
    if (dias.length > 0) {
      this.diaSeleccionadoIso.set(this.formatearAFechaLocalIso(dias[0]));
    }
  }

  private formatearAFechaLocalIso(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async cargarDetallePelicula(id: string) {
    const { data } = await this.supabaseService.client
      .from('peliculas')
      .select('*')
      .eq('id', id)
      .single();

    if (data) this.pelicula.set(data);
  }

  async cargarFunciones(peliculaId: string) {
    const { data } = await this.supabaseService.client
      .from('funciones')
      .select('*, salas(nombre)')
      .eq('pelicula_id', peliculaId);

    if (data) this.funciones.set(data);
  }

  async cargarResenas(peliculaId: string) {
    // 1. Cargar las reseñas de la película
    const { data: resenasData, error } = await this.supabaseService.client
      .from('resenas')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('created_at', { ascending: false });

    if (error || !resenasData) {
      this.resenas.set([]);
      this.cdr.detectChanges();
      return;
    }

    // 2. Extraer los usuario_id para buscar sus nombres en perfiles
    const usuarioIds = resenasData
      .map((r: any) => r.usuario_id)
      .filter((id: any) => id !== null && id !== undefined);

    let perfilesMap = new Map<string, any>();

    if (usuarioIds.length > 0) {
      const { data: perfilesData } = await this.supabaseService.client
        .from('perfiles')
        .select('id, nombre, apellido')
        .in('id', usuarioIds);

      if (perfilesData) {
        perfilesData.forEach((p: any) => perfilesMap.set(p.id, p));
      }
    }

    // 3. Formatear la lista para la vista
    const resenasProcesadas: Resena[] = resenasData.map((r: any) => {
      const perfil = perfilesMap.get(r.usuario_id);
      const nombreDinamico = perfil 
        ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim()
        : null;

      return {
        ...r,
        nombre_usuario: nombreDinamico || r.nombre_usuario || 'Cliente Cine UTN'
      };
    });

    this.resenas.set(resenasProcesadas);
    this.cdr.detectChanges();
  }

  funcionesDelDia() {
    const diaActivo = this.diaSeleccionadoIso();
    return this.funciones().filter(f => {
      if (!f.fecha_hora) return false;
      const fechaFn = new Date(f.fecha_hora);
      const fechaFnIso = this.formatearAFechaLocalIso(fechaFn);
      return fechaFnIso === diaActivo;
    });
  }

  funcionesAgrupadas() {
    const lista = this.funcionesDelDia();
    const grupos: { [key: string]: any[] } = {};

    lista.forEach(fn => {
      const formato = fn.formato || '2D';
      const idioma = (fn.idioma || 'CASTELLANO').toUpperCase();
      const clave = `${formato} ${idioma}`;

      if (!grupos[clave]) grupos[clave] = [];
      grupos[clave].push(fn);
    });

    return grupos;
  }

  tieneFuncionesAgrupadas(): boolean {
    return Object.keys(this.funcionesAgrupadas()).length > 0;
  }

  obtenerClavesAgrupadas(): string[] {
    return Object.keys(this.funcionesAgrupadas());
  }

  seleccionarFuncion(id: string) {
    this.funcionSeleccionadaId.set(id);
  }

  seleccionarDia(dia: Date) {
    const iso = this.formatearAFechaLocalIso(dia);
    this.diaSeleccionadoIso.set(iso);
    this.funcionSeleccionadaId.set(null);
  }

  esDiaSeleccionado(dia: Date): boolean {
    return this.diaSeleccionadoIso() === this.formatearAFechaLocalIso(dia);
  }

  irASeleccionButacas() {
    const fnId = this.funcionSeleccionadaId();
    if (!fnId) return alert('Seleccioná un horario para continuar.');
    this.router.navigate(['/seleccion-entradas', fnId]);
  }

  volverACartelera() {
    this.router.navigate(['/cartelera']);
  }

  obtenerGenerosFormateados(generosData: any): string {
    if (Array.isArray(generosData)) return generosData.join(', ');
    if (typeof generosData === 'string') return generosData;
    return 'Sin género';
  }

  obtenerNombreDiaEspanol(fecha: Date): string {
    const dias = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    return dias[fecha.getDay()];
  }
}