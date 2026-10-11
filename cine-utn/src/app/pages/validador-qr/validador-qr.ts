import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';

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
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  codigoQrInput: string = '';
  cargando: boolean = false;
  ventaEncontrada: any = null;
  mensajeEstado: { texto: string; tipo: 'success' | 'danger' | 'warning' | 'info' } | null = null;
  usuarioStaff: any = null;

  async ngOnInit() {
    const perfil = await this.authService.getPerfilActual();
    if (!perfil || (perfil.rol !== 'empleado' && perfil.rol !== 'admin' && perfil.rol !== 'gerente')) {
      alert('Acceso restringido únicamente para el personal del cine.');
      this.router.navigate(['/cartelera']);
      return;
    }
    this.usuarioStaff = perfil;
    this.cdr.detectChanges();
  }

  async buscarVentaPorCodigo() {
    const codigoLimpio = this.codigoQrInput.trim();
    if (!codigoLimpio) return;

    this.cargando = true;
    this.ventaEncontrada = null;
    this.mensajeEstado = null;

    try {
      const { data, error } = await this.supabaseService.client
        .from('ventas')
        .select(', funciones(, peliculas(), salas())')
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
    if (venta.estado_qr === 'cancelado') {
      this.mensajeEstado = { texto: '🚫 Esta reserva se encuentra CANCELADA.', tipo: 'danger' };
    } else if (venta.estado_qr === 'usado_total') {
      this.mensajeEstado = { texto: '⚠️ Entrada y Combo Candy ya fueron consumidos en su totalidad.', tipo: 'warning' };
    } else if (venta.entradas_validadas && venta.candy_entregado) {
      this.mensajeEstado = { texto: '✔️ Reserva completada en su totalidad.', tipo: 'info' };
    } else {
      this.mensajeEstado = { texto: '✅ Código VÁLIDO. Listo para control.', tipo: 'success' };
    }
  }

  async validarIngresoCine() {
    if (!this.ventaEncontrada) return;

    if (this.ventaEncontrada.entradas_validadas) {
      return alert('Las entradas de esta reserva ya fueron validadas previamente.');
    }

    this.cargando = true;
    const nuevoEstado = this.ventaEncontrada.candy_entregado ? 'usado_total' : 'usado_cine';

    const { error } = await this.supabaseService.client
      .from('ventas')
      .update({
        entradas_validadas: true,
        estado_qr: nuevoEstado
      })
      .eq('id', this.ventaEncontrada.id);

    this.cargando = false;

    if (error) {
      alert('Error al validar ingreso: ' + error.message);
    } else {
      this.ventaEncontrada.entradas_validadas = true;
      this.ventaEncontrada.estado_qr = nuevoEstado;
      this.evaluarEstadoQR(this.ventaEncontrada);
      alert('🎟️ ¡Ingreso a la sala VALIDADO con éxito!');
      this.cdr.detectChanges();
    }
  }
async entregarCandyBar() {
    if (!this.ventaEncontrada) return;

    if (this.ventaEncontrada.candy_entregado) {
      return alert('Los productos de Candy Bar de esta reserva ya fueron entregados.');
    }

    this.cargando = true;
    const nuevoEstado = this.ventaEncontrada.entradas_validadas ? 'usado_total' : 'usado_candy';

    // FIX: Eliminar el .select('*') previo al .update
    const { error } = await this.supabaseService.client
      .from('ventas')
      .update({
        candy_entregado: true,
        estado_qr: nuevoEstado
      })
      .eq('id', this.ventaEncontrada.id);

    this.cargando = false;

    if (error) {
      alert('Error al entregar Candy Bar: ' + error.message);
    } else {
      this.ventaEncontrada.candy_entregado = true;
      this.ventaEncontrada.estado_qr = nuevoEstado;
      this.evaluarEstadoQR(this.ventaEncontrada);
      alert('🍿 ¡Entrega de Candy Bar REGISTRADA con éxito!');
      this.cdr.detectChanges();
    }
  }

  limpiarFormulario() {
    this.codigoQrInput = '';
    this.ventaEncontrada = null;
    this.mensajeEstado = null;
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