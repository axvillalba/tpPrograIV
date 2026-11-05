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

  // Variables de clase
  perfilUsuario: any = null;
  ventas: any[] = [];
  resenasDelUsuario: any[] = [];
  peliculasCompradas: any[] = [];
  cargando: boolean = true;

  // Fidelización (Puntos)
  historialPuntos: any[] = [];
  saldoPuntos: number = 0;
  recompensasDisponibles: any[] = [];

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

      // 2. Obtener el perfil detallado de 'perfiles'
      let perfil = await this.authService.getPerfilActual();

      if (!perfil && user) {
        perfil = {
          id: user.id,
          email: user.email,
          nombre: user.user_metadata?.['nombre'] || 'Usuario',
          apellido: user.user_metadata?.['apellido'] || '',
          rol: user.user_metadata?.['rol'] || 'cliente',
          puntos_fidelidad: 0,
          credito_saldo: 0
        };
      }

      if (!user && !perfil) {
        this.router.navigate(['/login']);
        return;
      }

      this.perfilUsuario = perfil;

      if (perfil?.id) {
        await Promise.all([
          this.cargarHistorialVentas(perfil.id),
          this.cargarResenasDelUsuario(perfil.id),
          this.cargarMovimientosPuntos(perfil.id),
          this.cargarRecompensasDisponibles()
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

  // --- CANCELACIÓN DE RESERVAS Y CRÉDITO A FAVOR ---

  // Verifica si faltan 2 horas o más para la función
  puedeCancelarCompra(fechaFuncionISO: string): boolean {
    if (!fechaFuncionISO) return false;
    const fechaFuncion = new Date(fechaFuncionISO).getTime();
    const ahora = new Date().getTime();
    const diferenciaHoras = (fechaFuncion - ahora) / (1000 * 60 * 60);

    return diferenciaHoras >= 2;
  }

  async cancelarCompra(venta: any) {
    const fechaFuncion = venta.funcion?.fecha_hora;
    if (!this.puedeCancelarCompra(fechaFuncion)) {
      alert('Las compras solo pueden cancelarse hasta 2 horas antes del inicio de la función.');
      return;
    }

    if (!confirm(`¿Confirmás la cancelación de esta reserva? Se acreditarán $${venta.monto_total} como saldo a favor en tu perfil.`)) {
      return;
    }

    try {
      this.cargando = true;
      const perfilActual = this.perfilUsuario;
      const saldoActual = Number(perfilActual?.credito_saldo) || 0;
      const nuevoSaldo = saldoActual + Number(venta.monto_total);

      // 1. Marcar la venta como cancelada en la BD
      const { error: errVenta } = await this.supabaseService.client
        .from('ventas')
        .update({ estado_qr: 'cancelado' })
        .eq('id', venta.id);

      if (errVenta) throw errVenta;

      // 2. Acreditar el saldo en la cuenta del usuario
      const { error: errPerfil } = await this.supabaseService.client
        .from('perfiles')
        .update({ credito_saldo: nuevoSaldo })
        .eq('id', perfilActual.id);

      if (errPerfil) throw errPerfil;

      // Actualizar localmente el estado de la pantalla
      this.perfilUsuario.credito_saldo = nuevoSaldo;
      venta.estado_qr = 'cancelado';

      alert(`✔️ Compra cancelada con éxito. Tenés $${nuevoSaldo} de crédito disponible en tu perfil.`);
      if (perfilActual?.id) {
        await this.cargarHistorialVentas(perfilActual.id);
      }
    } catch (err: any) {
      console.error('Error al cancelar compra:', err);
      alert('No se pudo cancelar la compra: ' + err.message);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  // --- FIDELIZACIÓN: MÉTODOS DE PUNTOS Y RECOMPENSAS ---

  async cargarMovimientosPuntos(userId: string) {
    try {
      const { data, error } = await this.supabaseService.client
        .from('movimientos_puntos')
        .select('*')
        .eq('usuario_id', userId)
        .order('fecha', { ascending: false });

      if (error) {
        console.error('Error cargando historial de puntos:', error);
        return;
      }

      if (data) {
        this.historialPuntos = data;
        this.saldoPuntos = data.reduce((acc: number, mov: any) => acc + (mov.cantidad || 0), 0);
      }
    } catch (err) {
      console.error('Excepción al cargar puntos:', err);
    }
  }

  async cargarRecompensasDisponibles() {
    try {
      const { data, error } = await this.supabaseService.client
        .from('recompensas')
        .select('*')
        .eq('activo', true)
        .order('costo_puntos', { ascending: true });

      if (error) {
        console.error('Error al cargar recompensas:', error);
        return;
      }

      if (data) {
        this.recompensasDisponibles = data;
      }
    } catch (err) {
      console.error('Excepción al cargar catálogo de recompensas:', err);
    }
  }

  async canjearRecompensa(recompensa: any) {
    if (this.saldoPuntos < recompensa.costo_puntos) {
      return alert(`No tenés puntos suficientes. Necesitás ${recompensa.costo_puntos} pts y tenés ${this.saldoPuntos} pts.`);
    }

    if (!confirm(`¿Deseás canjear "${recompensa.nombre}" por ${recompensa.costo_puntos} puntos?`)) return;

    const userId = this.perfilUsuario?.id;
    if (!userId) return;

    const { error } = await this.supabaseService.client
      .from('movimientos_puntos')
      .insert([{
        usuario_id: userId,
        cantidad: -recompensa.costo_puntos,
        motivo: `Canje de premio: ${recompensa.nombre}`,
        fecha: new Date().toISOString()
      }]);

    if (error) {
      alert('Error al procesar el canje: ' + error.message);
    } else {
      const beneficiosPrevios = JSON.parse(localStorage.getItem('beneficios_canjeados') || '[]');
      beneficiosPrevios.push({
        id: crypto.randomUUID(),
        recompensa_id: recompensa.id,
        nombre: recompensa.nombre,
        tipo: recompensa.tipo,
        costo_puntos: recompensa.costo_puntos
      });
      localStorage.setItem('beneficios_canjeados', JSON.stringify(beneficiosPrevios));

      alert(`¡Canje exitoso! Tenés disponible "${recompensa.nombre}". Se aplicará en tu próximo checkout.`);

      await this.cargarMovimientosPuntos(userId);
      this.cdr.detectChanges();
    }
  }

  // --- HISTORIAL DE VENTAS Y RESEÑAS ---

  async cargarHistorialVentas(userId: string) {
    try {
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

      const funcionIds = ventasData
        .map((v: any) => v.funcion_id)
        .filter((id: any) => id !== null && id !== undefined);

      if (funcionIds.length === 0) {
        this.ventas = ventasData;
        return;
      }

      const { data: funcionesData } = await this.supabaseService.client
        .from('funciones')
        .select('*, peliculas(*)')
        .in('id', funcionIds);

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