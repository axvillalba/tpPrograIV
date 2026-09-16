import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { NavbarComponent } from '../../components/navbar/navbar';
import { RealtimeChannel } from '@supabase/supabase-js';

interface Butaca {
  fila: string;
  columna: number;
  bloque: number;
  tipo: 'estandar' | 'discapacidad' | 'vip';
  ocupada: boolean;
  seleccionada: boolean;
  precio: number;
}

interface Resena {
  id?: string;
  nombre_usuario: string;
  calificacion: number;
  comentario: string;
  created_at?: string;
}

@Component({
  selector: 'app-seleccion-entradas',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './seleccion-entradas.html',
  styleUrl: './seleccion-entradas.css'
})
export class SeleccionEntradasComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  private canalRealtime: RealtimeChannel | null = null;

  pelicula = signal<any>(null);
  funciones = signal<any[]>([]);
  funcionSeleccionada = signal<any>(null);
  mapaButacas = signal<Butaca[]>([]);
  advertenciaEdad = signal<string | null>(null);
  usuarioActual = signal<any>(null);

  // Estados de Reseñas y Puntuaciones
  resenas = signal<Resena[]>([]);
  promedioCalificacion = computed(() => {
    const list = this.resenas();
    if (list.length === 0) return 0;
    const suma = list.reduce((acc, r) => acc + r.calificacion, 0);
    return (suma / list.length).toFixed(1);
  });

  nuevaCalificacion = signal<number>(5);
  nuevoComentario = signal<string>('');
  mensajeExitoResena = signal<boolean>(false);

  filas = ['A','B','C','D','E','F','G','H','I','DISC','L','M','N','O','P','Q','R','S','T'];

  butacasSeleccionadas = computed(() => this.mapaButacas().filter(b => b.seleccionada));
  montoTotal = computed(() => this.butacasSeleccionadas().reduce((acc, curr) => acc + curr.precio, 0));

  async ngOnInit() {
    try {
      const peliculaId = this.route.snapshot.paramMap.get('id');
      if (!peliculaId) return;

      const perfil = await this.authService.getPerfilActual();
      this.usuarioActual.set(perfil);

      await this.cargarPeliculaYFunciones(peliculaId);
      await this.cargarResenas(peliculaId);
    } catch (err) {
      console.error('Error al inicializar:', err);
    }
  }

  ngOnDestroy() {
    if (this.canalRealtime) {
      this.supabaseService.client.removeChannel(this.canalRealtime);
    }
  }

  private async cargarPeliculaYFunciones(peliculaId: string) {
    const { data: p } = await this.supabaseService.client
      .from('peliculas')
      .select('*')
      .eq('id', peliculaId)
      .maybeSingle();

    if (p) this.pelicula.set(p);

    const { data: fList } = await this.supabaseService.client
      .from('funciones')
      .select('*, salas(nombre)')
      .eq('pelicula_id', peliculaId)
      .order('horario_inicio', { ascending: true });

    if (fList && fList.length > 0) {
      this.funciones.set(fList);
      this.seleccionarFuncion(fList[0]);
    }
  }

  async seleccionarFuncion(f: any) {
    this.funcionSeleccionada.set(f);
    this.generarMapaSalas();
    await this.cargarButacasOcupadas(f.id);
    this.suscribirAOcumpacionEnTiempoReal(f.id);
  }

private generarMapaSalas() {
  const precioBase = this.funcionSeleccionada()?.precio_base || 5000;
  const listado: Butaca[] = [];

  this.filas.forEach(fila => {
    const esDiscapacidad = fila === 'DISC';
    const esVip = fila === 'R' || fila === 'S' || fila === 'T';
    
    let tipo: 'estandar' | 'discapacidad' | 'vip' = 'estandar';
    let precio = precioBase;

    if (esDiscapacidad) {
      tipo = 'discapacidad';
    } else if (esVip) {
      tipo = 'vip';
      precio = precioBase * 1.35;
    }

    // Configuración exacta:
    // Filas Estándar/VIP: 4 (Izq) - 20 (Centro) - 4 (Der) = 28 butacas
    // Fila Única DISC:    2 (Izq) - 10 (Centro) - 2 (Der) = 14 butacas
    const cantIzq = esDiscapacidad ? 2 : 4;
    const cantCentro = esDiscapacidad ? 10 : 20;
    const cantDer = esDiscapacidad ? 2 : 4;

    let numeroAsiento = 1;

    // Bloque 1 (Izquierda)
    for (let c = 1; c <= cantIzq; c++) {
      listado.push({ fila, columna: numeroAsiento++, bloque: 1, tipo, ocupada: false, seleccionada: false, precio });
    }
    // Bloque 2 (Centro)
    for (let c = 1; c <= cantCentro; c++) {
      listado.push({ fila, columna: numeroAsiento++, bloque: 2, tipo, ocupada: false, seleccionada: false, precio });
    }
    // Bloque 3 (Derecha)
    for (let c = 1; c <= cantDer; c++) {
      listado.push({ fila, columna: numeroAsiento++, bloque: 3, tipo, ocupada: false, seleccionada: false, precio });
    }
  });

  this.mapaButacas.set(listado);
}

  private async cargarButacasOcupadas(funcionId: string) {
    const { data: ventasExistentes } = await this.supabaseService.client
      .from('ventas')
      .select('detalle_butacas')
      .eq('funcion_id', funcionId);

    if (ventasExistentes && ventasExistentes.length > 0) {
      const asientosCompradosSet = new Set<string>();

      ventasExistentes.forEach((v: any) => {
        const detalle = v['detalle_butacas'];
        if (detalle && Array.isArray(detalle)) {
          detalle.forEach((b: any) => {
            asientosCompradosSet.add(`${b.fila}-${b.columna}`);
          });
        }
      });

      this.mapaButacas.update(asientos =>
        asientos.map(b => ({
          ...b,
          ocupada: asientosCompradosSet.has(`${b.fila}-${b.columna}`),
          seleccionada: asientosCompradosSet.has(`${b.fila}-${b.columna}`) ? false : b.seleccionada
        }))
      );
    }
  }

  private suscribirAOcumpacionEnTiempoReal(funcionId: string) {
    if (this.canalRealtime) {
      this.supabaseService.client.removeChannel(this.canalRealtime);
    }

    this.canalRealtime = this.supabaseService.client
      .channel(`ventas-funcion-${funcionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ventas', filter: `funcion_id=eq.${funcionId}` },
        (payload) => {
          const nuevaVenta = payload.new as Record<string, any>;
          const detalleButacas = nuevaVenta ? nuevaVenta['detalle_butacas'] : null;

          if (detalleButacas && Array.isArray(detalleButacas)) {
            const nuevasOcupadas = new Set<string>();
            detalleButacas.forEach((b: any) => {
              nuevasOcupadas.add(`${b.fila}-${b.columna}`);
            });

            this.mapaButacas.update(asientos =>
              asientos.map(b => {
                const clave = `${b.fila}-${b.columna}`;
                if (nuevasOcupadas.has(clave)) {
                  return { ...b, ocupada: true, seleccionada: false };
                }
                return b;
              })
            );
          }
        }
      )
      .subscribe();
  }

  toggleButaca(b: Butaca) {
    if (b.ocupada) return;
    b.seleccionada = !b.seleccionada;
    this.mapaButacas.update(arr => [...arr]);
  }

  getButacasPorFilaYBloque(fila: string, bloque: number) {
    return this.mapaButacas().filter(b => b.fila === fila && b.bloque === bloque);
  }

  continuarAlCandy() {
    const entradas = this.butacasSeleccionadas();
    if (entradas.length === 0) return;

    localStorage.setItem('entradas_seleccionadas', JSON.stringify({
      pelicula: this.pelicula(),
      funcion: this.funcionSeleccionada(),
      butacas: entradas,
      montoEntradas: this.montoTotal()
    }));

    this.router.navigate(['/candy']);
  }

  // --- LÓGICA DE RESEÑAS ---
  async cargarResenas(peliculaId: string) {
    const { data } = await this.supabaseService.client
      .from('resenas')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .order('created_at', { ascending: false });

    if (data) {
      this.resenas.set(data);
    }
  }

  async agregarResena() {
    if (!this.nuevoComentario().trim()) return;

    const peliculaId = this.pelicula()?.id;
    const perfil = this.usuarioActual();
    const nombreUsuario = perfil ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() : 'Cliente Cine UTN';

    const nueva = {
      pelicula_id: peliculaId,
      usuario_id: perfil?.id || null,
      nombre_usuario: nombreUsuario || 'Cliente',
      calificacion: Number(this.nuevaCalificacion()),
      comentario: this.nuevoComentario().trim()
    };

    const { error } = await this.supabaseService.client
      .from('resenas')
      .insert([nueva]);

    if (!error) {
      this.nuevoComentario.set('');
      this.mensajeExitoResena.set(true);
      await this.cargarResenas(peliculaId);

      setTimeout(() => {
        this.mensajeExitoResena.set(false);
      }, 4000);
    }
  }
}