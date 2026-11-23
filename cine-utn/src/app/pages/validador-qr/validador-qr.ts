import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { AuditoriaService } from '../../services/auditoria';

@Component({
  selector: 'app-validador-qr',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './validador-qr.html',
  styleUrl: './validador-qr.css'
})
export class ValidadorQrComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private auditoriaService = inject(AuditoriaService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  codigoQrInput: string = '';
  cargando: boolean = false;
  ventaEncontrada: any = null;
  mensajeEstado: { texto: string; tipo: 'success' | 'danger' | 'warning' | 'info' } | null = null;
  avisoFechaFuncion: string | null = null;
  usuarioStaff: any = null;

  get esReservaCancelada(): boolean {
    if (!this.ventaEncontrada) return false;
    return (
      this.ventaEncontrada.estado_qr === 'cancelado' ||
      this.ventaEncontrada.funciones?.estado === 'cancelada'
    );
  }

  async ngOnInit() {
    const perfil = await this.authService.getPerfilActual();
    if (
      !perfil ||
      perfil.activo === false ||
      (perfil.rol !== 'empleado' && perfil.rol !== 'admin' && perfil.rol !== 'gerente')
    ) {
      alert('Acceso restringido únicamente para el personal activo del cine.');
      this.router.navigate(['/cartelera']);
      return;
    }
    this.usuarioStaff = perfil;
    this.cdr.detectChanges();
  }

  async buscarVentaPorCodigo() {
    const codigoLimpio = this.codigoQrInput.trim().toUpperCase();
    if (!codigoLimpio) return;

    this.codigoQrInput = codigoLimpio;
    this.cargando = true;
    this.ventaEncontrada = null;
    this.mensajeEstado = null;
    this.avisoFechaFuncion = null;

    try {
      const { data, error } = await this.supabaseService.client
        .from('ventas')
        .select('*, funciones(*, peliculas(*), salas(*))')
        .eq('codigo_qr', codigoLimpio)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        this.mensajeEstado = {
          texto: '❌ Código de reserva / QR no encontrado en el sistema.',
          tipo: 'danger'
        };
      } else {
        this.ventaEncontrada = data;
        this.evaluarEstadoQR(data);
        this.evaluarFechaFuncion(data);
      }
    } catch (err: any) {
      console.error('Error al consultar código:', err);
      this.mensajeEstado = {
        texto: 'Error de conexión al consultar el código: ' + (err.message || 'Error desconocido'),
        tipo: 'danger'
      };
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  private evaluarEstadoQR(venta: any) {
    if (venta.estado_qr === 'cancelado' || venta.funciones?.estado === 'cancelada') {
      this.mensajeEstado = {
        texto: '🚫 RESERVA CANCELADA O FUNCIÓN ANULADA. No habilitar ingreso ni entrega.',
        tipo: 'danger'
      };
    } else if (venta.estado_qr === 'usado_total') {
      this.mensajeEstado = {
        texto: '⚠️ Entrada y Combo Candy ya fueron consumidos en su totalidad.',
        tipo: 'warning'
      };
    } else if (venta.entradas_validadas && venta.candy_entregado) {
      this.mensajeEstado = {
        texto: '✔️ Reserva completada en su totalidad.',
        tipo: 'info'
      };
    } else {
      this.mensajeEstado = {
        texto: '✅ Código VÁLIDO. Listo para control.',
        tipo: 'success'
      };
    }
  }

  private evaluarFechaFuncion(venta: any) {
    const fechaRaw = venta.funciones?.fecha_hora;
    if (!fechaRaw) return;

    const fechaFn = new Date(fechaRaw);
    const hoy = new Date();
    const esMismoDia =
      fechaFn.getDate() === hoy.getDate() &&
      fechaFn.getMonth() === hoy.getMonth() &&
      fechaFn.getFullYear() === hoy.getFullYear();

    if (!esMismoDia) {
      this.avisoFechaFuncion = `⚠️ Atención: Esta entrada corresponde a otra fecha (${this.formatearFecha(fechaRaw)} hs).`;
    }
  }

  async validarIngresoCine() {
    if (!this.ventaEncontrada) return;

    if (this.esReservaCancelada) {
      return alert('🚫 Esta reserva está CANCELADA. No se puede validar el ingreso.');
    }

    if (this.ventaEncontrada.entradas_validadas) {
      return alert('Las entradas de esta reserva ya fueron validadas previamente.');
    }

    this.cargando = true;
    const sinCandy = !this.ventaEncontrada.detalle_candy?.length;
    const nuevoEstado =
      this.ventaEncontrada.candy_entregado || sinCandy ? 'usado_total' : 'usado_cine';
    const ahoraIso = new Date().toISOString();

    const { error } = await this.supabaseService.client
      .from('ventas')
      .update({
        entradas_validadas: true,
        estado_qr: nuevoEstado,
        fecha_validacion: ahoraIso
      })
      .eq('id', this.ventaEncontrada.id);

    this.cargando = false;

    if (error) {
      alert('Error al validar ingreso: ' + error.message);
    } else {
      this.ventaEncontrada.entradas_validadas = true;
      this.ventaEncontrada.estado_qr = nuevoEstado;
      this.evaluarEstadoQR(this.ventaEncontrada);

      await this.auditoriaService.registrarAccion('VALIDAR_INGRESO_SALA', {
        codigo_qr: this.ventaEncontrada.codigo_qr,
        venta_id: this.ventaEncontrada.id,
        pelicula: this.ventaEncontrada.funciones?.peliculas?.titulo,
        estado_qr: nuevoEstado
      });

      alert('🎟️ ¡Ingreso a la sala VALIDADO con éxito!');
      this.cdr.detectChanges();
    }
  }

  async entregarCandyBar() {
    if (!this.ventaEncontrada) return;

    if (this.esReservaCancelada) {
      return alert('🚫 Esta reserva está CANCELADA. No se puede entregar Candy Bar.');
    }

    if (this.ventaEncontrada.candy_entregado) {
      return alert('Los productos de Candy Bar de esta reserva ya fueron entregados.');
    }

    this.cargando = true;
    const nuevoEstado = this.ventaEncontrada.entradas_validadas ? 'usado_total' : 'usado_candy';
    const ahoraIso = new Date().toISOString();

    const { error } = await this.supabaseService.client
      .from('ventas')
      .update({
        candy_entregado: true,
        estado_qr: nuevoEstado,
        fecha_validacion: ahoraIso
      })
      .eq('id', this.ventaEncontrada.id);

    this.cargando = false;

    if (error) {
      alert('Error al entregar Candy Bar: ' + error.message);
    } else {
      this.ventaEncontrada.candy_entregado = true;
      this.ventaEncontrada.estado_qr = nuevoEstado;
      this.evaluarEstadoQR(this.ventaEncontrada);

      await this.auditoriaService.registrarAccion('ENTREGAR_CANDY_BAR', {
        codigo_qr: this.ventaEncontrada.codigo_qr,
        venta_id: this.ventaEncontrada.id,
        estado_qr: nuevoEstado
      });

      alert('🍿 ¡Entrega de Candy Bar REGISTRADA con éxito!');
      this.cdr.detectChanges();
    }
  }

  limpiarFormulario() {
    this.codigoQrInput = '';
    this.ventaEncontrada = null;
    this.mensajeEstado = null;
    this.avisoFechaFuncion = null;
    this.cdr.detectChanges();
  }

  formatearFecha(fechaRaw: string): string {
    if (!fechaRaw) return 'N/A';
    const f = new Date(fechaRaw);
    return f.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  volverACartelera() {
    this.router.navigate(['/cartelera']);
  }
}