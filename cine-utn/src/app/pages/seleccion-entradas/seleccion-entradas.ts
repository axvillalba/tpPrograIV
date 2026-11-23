import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { ListaEsperaService, RegistroListaEspera } from '../../services/lista-espera';
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
  imports: [CommonModule, FormsModule, NavbarComponent, RouterLink],
  templateUrl: './seleccion-entradas.html',
  styleUrl: './seleccion-entradas.css'
})
export class SeleccionEntradasComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  listaEsperaService = inject(ListaEsperaService);

  private canalRealtime: RealtimeChannel | null = null;
  private canalListaEspera: RealtimeChannel | null = null;

  pelicula = signal<any>(null);
  funcionSeleccionada = signal<any>(null);
  mapaButacas = signal<Butaca[]>([]);
  usuarioActual = signal<any>(null);

  // Estados de Lista de Espera
  miRegistroEspera = signal<RegistroListaEspera | null>(null);
  posicionEnFila = signal<number>(0);
  turnoExclusivoOtroUsuario = signal<boolean>(false);
  cantidadLugaresEspera = signal<number>(1);
  usuarioLogueadoId = computed(() => this.usuarioActual()?.id || this.authService.currentUser()?.id || null);

  butacasLibres = computed(() => this.mapaButacas().filter(b => !b.ocupada).length);

  mostrarPanelListaEspera = computed(() => {
    // Si este usuario tiene su ventana activa de 15 min, siempre ve el mapa para elegir su asiento
    if (this.miRegistroEspera()?.estado === 'notificado') {
      return false;
    }
    // Si la sala está llena o si el lugar liberado pertenece al turno exclusivo de 15 min de otro usuario
    return this.butacasLibres() === 0 || this.turnoExclusivoOtroUsuario();
  });

  // Estados de Reseñas y Puntuaciones
  resenas = signal<Resena[]>([]);
  promedioCalificacion = computed(() => {
    const list = this.resenas();
    if (list.length === 0) return 0;
    const suma = list.reduce((acc, r) => acc + r.calificacion, 0);
    return (suma / list.length).toFixed(1);
  });

  filas = ['A','B','C','D','E','F','G','H','I','DISC','L','M','N','O','P','Q','R','S','T'];

  butacasSeleccionadas = computed(() => this.mapaButacas().filter(b => b.seleccionada));
  montoTotal = computed(() => this.butacasSeleccionadas().reduce((acc, curr) => acc + curr.precio, 0));

  async ngOnInit() {
    try {
      const funcionId = this.route.snapshot.paramMap.get('id');
      if (!funcionId) return;

      const perfil = await this.authService.getPerfilActual();
      this.usuarioActual.set(perfil);

      await this.cargarFuncionYPelicula(funcionId);
      await this.actualizarEstadoCola(funcionId);
      this.suscribirAColaEnTiempoReal(funcionId);
    } catch (err) {
      console.error('Error al inicializar:', err);
    }
  }

  ngOnDestroy() {
    if (this.canalRealtime) {
      this.supabaseService.client.removeChannel(this.canalRealtime);
    }
    if (this.canalListaEspera) {
      this.supabaseService.client.removeChannel(this.canalListaEspera);
    }
  }

  private async cargarFuncionYPelicula(funcionId: string) {
    const { data: f, error } = await this.supabaseService.client
      .from('funciones')
      .select('*, peliculas(*), salas(*)')
      .eq('id', funcionId)
      .maybeSingle();

    if (error || !f) {
      console.error('Error al cargar la función:', error);
      return;
    }

    this.funcionSeleccionada.set(f);
    if (f.peliculas) {
      this.pelicula.set(f.peliculas);
      await this.cargarResenas(f.peliculas.id);
    }

    this.generarMapaSalas();
    await this.cargarButacasOcupadas(funcionId);
    this.suscribirAOcumpacionEnTiempoReal(funcionId);
  }

  private generarMapaSalas() {
    const precioBase = this.funcionSeleccionada()?.precio_base || 4500;
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

      const cantIzq = esDiscapacidad ? 2 : 4;
      const cantCentro = esDiscapacidad ? 10 : 20;
      const cantDer = esDiscapacidad ? 2 : 4;

      let numeroAsiento = 1;

      for (let c = 1; c <= cantIzq; c++) {
        listado.push({ fila, columna: numeroAsiento++, bloque: 1, tipo, ocupada: false, seleccionada: false, precio });
      }
      for (let c = 1; c <= cantCentro; c++) {
        listado.push({ fila, columna: numeroAsiento++, bloque: 2, tipo, ocupada: false, seleccionada: false, precio });
      }
      for (let c = 1; c <= cantDer; c++) {
        listado.push({ fila, columna: numeroAsiento++, bloque: 3, tipo, ocupada: false, seleccionada: false, precio });
      }
    });

    this.mapaButacas.set(listado);
  }

  private async cargarButacasOcupadas(funcionId: string) {
    const { data: ventasExistentes } = await this.supabaseService.client
      .from('ventas')
      .select('detalle_butacas, estado_qr')
      .eq('funcion_id', funcionId)
      .neq('estado_qr', 'cancelado');

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
        { event: '*', schema: 'public', table: 'ventas', filter: `funcion_id=eq.${funcionId}` },
        async (payload) => {
          // 1. Cuando se concreta una nueva venta activa: inhabilitar butacas
          if (payload.eventType === 'INSERT') {
            const nuevaVenta = payload.new as Record<string, any>;
            if (nuevaVenta && nuevaVenta['estado_qr'] !== 'cancelado') {
              const detalleButacas = nuevaVenta['detalle_butacas'];
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
          }
          // 2. Cuando se cancela una reserva: liberar butacas y disparar turno de lista de espera
          else if (payload.eventType === 'UPDATE') {
            const ventaActualizada = payload.new as Record<string, any>;
            if (ventaActualizada && ventaActualizada['estado_qr'] === 'cancelado') {
              const detalleButacas = ventaActualizada['detalle_butacas'];
              if (detalleButacas && Array.isArray(detalleButacas)) {
                const liberadas = new Set<string>();
                detalleButacas.forEach((b: any) => {
                  liberadas.add(`${b.fila}-${b.columna}`);
                });

                this.mapaButacas.update(asientos =>
                  asientos.map(b => {
                    const clave = `${b.fila}-${b.columna}`;
                    if (liberadas.has(clave)) {
                      return { ...b, ocupada: false };
                    }
                    return b;
                  })
                );

                // Activa automáticamente la ventana de 15 min al #1 de la fila
                await this.actualizarEstadoCola(funcionId);
              }
            }
          }
        }
      )
      .subscribe();
  }

  private suscribirAColaEnTiempoReal(funcionId: string) {
    if (this.canalListaEspera) {
      this.supabaseService.client.removeChannel(this.canalListaEspera);
    }

    this.canalListaEspera = this.supabaseService.client
      .channel(`cola-funcion-${funcionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lista_espera', filter: `funcion_id=eq.${funcionId}` },
        async () => {
          await this.actualizarEstadoCola(funcionId);
        }
      )
      .subscribe();
  }

  private async actualizarEstadoCola(funcionId: string) {
    const turnoVigente = await this.listaEsperaService.procesarColaFuncion(funcionId);
    const userId = this.usuarioLogueadoId();

    if (turnoVigente && turnoVigente.usuario_id !== userId) {
      this.turnoExclusivoOtroUsuario.set(true);
    } else {
      this.turnoExclusivoOtroUsuario.set(false);
    }

    if (userId) {
      const { registro, posicion } = await this.listaEsperaService.obtenerEstadoEnFuncion(funcionId);
      this.miRegistroEspera.set(registro);
      this.posicionEnFila.set(posicion);
    } else {
      this.miRegistroEspera.set(null);
      this.posicionEnFila.set(0);
    }
  }

async anotarmeEnEspera() {
    try {
      const funcionId = this.funcionSeleccionada()?.id;
      if (!funcionId) return;

      const cantidad = Number(this.cantidadLugaresEspera()) || 1;
      await this.listaEsperaService.unirseAListaEspera(funcionId, cantidad);
      await this.actualizarEstadoCola(funcionId);
    } catch (err: any) {
      alert(err.message || 'No se pudo registrar en la lista de espera.');
    }
  }

  async bajarmeDeEspera() {
    const reg = this.miRegistroEspera();
    const funcionId = this.funcionSeleccionada()?.id;
    if (!reg || !funcionId) return;

    try {
      await this.listaEsperaService.salirDeListaEspera(reg.id, funcionId);
      await this.actualizarEstadoCola(funcionId);
    } catch (err: any) {
      alert(err.message || 'Error al salir de la lista de espera.');
    }
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
}