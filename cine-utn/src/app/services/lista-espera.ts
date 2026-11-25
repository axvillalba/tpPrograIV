import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { SupabaseService } from './supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface RegistroListaEspera {
  id: string;
  funcion_id: string;
  usuario_id: string;
  cantidad_butacas: number;
  estado: 'esperando' | 'notificado' | 'completado' | 'expirado' | 'cancelado';
  notificado_en: string | null;
  expira_en: string | null;
  created_at: string;
  funciones?: {
    id: string;
    fecha_hora: string;
    formato: string;
    idioma: string;
    peliculas?: { titulo: string; imagen_url?: string };
    salas?: { nombre: string };
  };
}

@Injectable({
  providedIn: 'root',
})
export class ListaEsperaService implements OnDestroy {
  private supabaseService = inject(SupabaseService);

  private canalRealtime: RealtimeChannel | null = null;
  private intervaloTimer: any = null;

  // Estado global del turno activo con ventana de 15 minutos
  turnoActivo = signal<RegistroListaEspera | null>(null);
  segundosRestantes = signal<number>(0);

  tiempoFormateado = computed(() => {
    const total = Math.max(0, this.segundosRestantes());
    const min = Math.floor(total / 60);
    const seg = total % 60;
    return `${min.toString().padStart(2, '0')}:${seg.toString().padStart(2, '0')}`;
  });

  // Solicitar permiso de notificaciones push del navegador
  async solicitarPermisoNotificaciones() {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }

private dispararNotificacionNativa(registro: RegistroListaEspera) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const tituloPeli = registro.funciones?.peliculas?.titulo || 'tu función';
      const cant = registro.cantidad_butacas || 1;
      const textoLugares = cant === 1 ? 'se liberó 1 lugar' : `se liberaron ${cant} lugares`;

      new Notification('🎟️ ¡Tu turno en Cine UTN!', {
        body: `¡${textoLugares[0].toUpperCase() + textoLugares.slice(1)} para ${tituloPeli}! Tenés 15 minutos exclusivos para completar tu compra.`,
        icon: registro.funciones?.peliculas?.imagen_url || '/favicon.png',
        tag: `lista-espera-${registro.id}`,
      });
    }
  }
  // Escuchar en tiempo real cuando el usuario recibe un turno de 15 min
  async iniciarEscuchaRealtime(usuarioId: string) {
    this.detenerEscuchaRealtime();
    await this.solicitarPermisoNotificaciones();

    // 1. Verificar si ya tiene un turno vigente al abrir/recargar la app
    await this.verificarTurnoVigenteUsuario(usuarioId);

    // 2. Suscribirse a cambios en vivo sobre sus registros de lista_espera
    this.canalRealtime = this.supabaseService.client
      .channel(`lista-espera-user-${usuarioId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lista_espera',
          filter: `usuario_id=eq.${usuarioId}`,
        },
        async (payload) => {
          const nuevo = payload.new as RegistroListaEspera;
          if (!nuevo) return;

          if (nuevo.estado === 'notificado' && nuevo.expira_en) {
            await this.cargarDetalleYActivarTurno(nuevo.id, true);
          } else if (
            this.turnoActivo()?.id === nuevo.id &&
            ['completado', 'expirado', 'cancelado'].includes(nuevo.estado)
          ) {
            this.limpiarTurnoLocal();
          }
        },
      )
      .subscribe();
  }

  detenerEscuchaRealtime() {
    if (this.canalRealtime) {
      this.supabaseService.client.removeChannel(this.canalRealtime);
      this.canalRealtime = null;
    }
    if (this.intervaloTimer) {
      clearInterval(this.intervaloTimer);
      this.intervaloTimer = null;
    }
  }

  private async verificarTurnoVigenteUsuario(usuarioId: string) {
    const ahoraIso = new Date().toISOString();
    const { data } = await this.supabaseService.client
      .from('lista_espera')
      .select('id, funcion_id, expira_en')
      .eq('usuario_id', usuarioId)
      .eq('estado', 'notificado')
      .gt('expira_en', ahoraIso)
      .order('expira_en', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (data) {
      await this.cargarDetalleYActivarTurno(data.id, false);
    }
  }

  private async cargarDetalleYActivarTurno(registroId: string, notificarPush: boolean) {
    const { data } = await this.supabaseService.client
      .from('lista_espera')
      .select('*, funciones(id, fecha_hora, formato, idioma, peliculas(titulo, imagen_url), salas(nombre))')
      .eq('id', registroId)
      .maybeSingle();

    if (!data || data.estado !== 'notificado' || !data.expira_en) return;

    const msRestantes = new Date(data.expira_en).getTime() - Date.now();
    if (msRestantes <= 0) {
      await this.procesarColaFuncion(data.funcion_id);
      return;
    }

    this.turnoActivo.set(data as RegistroListaEspera);
    this.iniciarCuentaRegresiva(data.funcion_id, data.expira_en);

    if (notificarPush) {
      this.dispararNotificacionNativa(data as RegistroListaEspera);
    }
  }

  private iniciarCuentaRegresiva(funcionId: string, expiraEnIso: string) {
    if (this.intervaloTimer) clearInterval(this.intervaloTimer);

    const actualizar = async () => {
      const diffSeg = Math.floor((new Date(expiraEnIso).getTime() - Date.now()) / 1000);
      if (diffSeg <= 0) {
        this.segundosRestantes.set(0);
        this.limpiarTurnoLocal();
        // Venció su ventana de 15 min: pasar turno al siguiente en la fila
        await this.procesarColaFuncion(funcionId);
      } else {
        this.segundosRestantes.set(diffSeg);
      }
    };

    actualizar();
    this.intervaloTimer = setInterval(actualizar, 1000);
  }

  private limpiarTurnoLocal() {
    this.turnoActivo.set(null);
    this.segundosRestantes.set(0);
    if (this.intervaloTimer) {
      clearInterval(this.intervaloTimer);
      this.intervaloTimer = null;
    }
  }

  // --- OPERACIONES DE NEGOCIO ---

  async unirseAListaEspera(funcionId: string, cantidadButacas: number = 1) {
    await this.solicitarPermisoNotificaciones();
    const { data: { user } } = await this.supabaseService.client.auth.getUser();
    if (!user) throw new Error('Tenés que iniciar sesión para anotarte en la lista de espera.');

    const { data, error } = await this.supabaseService.client
      .from('lista_espera')
      .insert({
        funcion_id: funcionId,
        usuario_id: user.id,
        cantidad_butacas: cantidadButacas,
        estado: 'esperando',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya estás anotado en la lista de espera de esta función.');
      }
      throw error;
    }

    return data as RegistroListaEspera;
  }

  async salirDeListaEspera(registroId: string, funcionId: string) {
    const { error } = await this.supabaseService.client
      .from('lista_espera')
      .update({ estado: 'cancelado' })
      .eq('id', registroId);

    if (error) throw error;

    if (this.turnoActivo()?.id === registroId) {
      this.limpiarTurnoLocal();
    }

    // Si tenía el turno activo y se bajó, notificar inmediatamente al siguiente
    await this.procesarColaFuncion(funcionId);
  }

  async obtenerEstadoEnFuncion(funcionId: string) {
    const { data: { user } } = await this.supabaseService.client.auth.getUser();
    if (!user) return { registro: null, posicion: 0 };

    // Primero depura turnos vencidos de la función para mantener la cola al día
    await this.procesarColaFuncion(funcionId);

    const { data: registro } = await this.supabaseService.client
      .from('lista_espera')
      .select('*')
      .eq('funcion_id', funcionId)
      .eq('usuario_id', user.id)
      .in('estado', ['esperando', 'notificado'])
      .maybeSingle();

    if (!registro) return { registro: null, posicion: 0 };

    const { data: pos } = await this.supabaseService.client.rpc('obtener_posicion_lista_espera', {
      p_funcion_id: funcionId,
      p_usuario_id: user.id,
    });

    return {
      registro: registro as RegistroListaEspera,
      posicion: Number(pos) || 1,
    };
  }

  // Llamar cuando se libera una butaca (cancelación) o cuando expira un turno
  async procesarColaFuncion(funcionId: string) {
    const { data, error } = await this.supabaseService.client.rpc('procesar_lista_espera', {
      p_funcion_id: funcionId,
    });
    if (error) console.error('Error procesando lista de espera:', error);
    return data as RegistroListaEspera | null;
  }

  // Llamar al confirmar la compra exitosa de la entrada
  async marcarCompraCompletada(funcionId: string) {
    const { data: { user } } = await this.supabaseService.client.auth.getUser();
    if (!user) return;

    await this.supabaseService.client
      .from('lista_espera')
      .update({ estado: 'completado' })
      .eq('funcion_id', funcionId)
      .eq('usuario_id', user.id)
      .eq('estado', 'notificado');

    this.limpiarTurnoLocal();
  }

  ngOnDestroy() {
    this.detenerEscuchaRealtime();
  }
}