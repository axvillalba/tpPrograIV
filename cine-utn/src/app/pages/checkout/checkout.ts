import { Component, OnInit, signal, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import * as QRCode from 'qrcode';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class CheckoutComponent implements OnInit {
  @ViewChild('canvasQR') canvasQR!: ElementRef<HTMLCanvasElement>;

  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private router = inject(Router);

  infoEntradas = signal<any>(null);
  infoCandy = signal<any>(null);
  descuentoPrimeraCompra = signal<boolean>(false);

  compraFinalizada = signal<boolean>(false);
  codigoQR = signal<string>('');
  cargando = signal<boolean>(false);

  montoEntradas = computed(() => this.infoEntradas()?.montoEntradas || 0);
  montoCandy = computed(() => this.infoCandy()?.totalCandy || 0);
  subtotal = computed(() => this.montoEntradas() + this.montoCandy());

  montoDescuento = computed(() => {
    return this.descuentoPrimeraCompra() ? this.subtotal() * 0.20 : 0;
  });

  totalPagar = computed(() => this.subtotal() - this.montoDescuento());

  async ngOnInit() {
    const entradas = localStorage.getItem('entradas_seleccionadas');
    const candy = localStorage.getItem('candy_seleccionado');

    if (!entradas) {
      this.router.navigate(['/cartelera']);
      return;
    }

    this.infoEntradas.set(JSON.parse(entradas));
    if (candy) this.infoCandy.set(JSON.parse(candy));

    await this.verificarDescuentoUsuario();
  }

  private async verificarDescuentoUsuario() {
    const perfil = await this.authService.getPerfilActual();
    if (perfil) {
      const { data: ventas } = await this.supabaseService.client
        .from('ventas')
        .select('id')
        .eq('user_id', perfil.id);

      if (!ventas || ventas.length === 0) {
        this.descuentoPrimeraCompra.set(true);
      }
    }
  }

  async procesarPago() {
    this.cargando.set(true);
    try {
      const user = this.authService.currentUser();
      const uuidVenta = crypto.randomUUID();
      const tokenQR = `CINE-UTN-${uuidVenta}`;

      const funcionObj = this.infoEntradas()?.funcion;
      const funcionId = funcionObj?.id || null;

      const { error } = await this.supabaseService.client
        .from('ventas')
        .insert({
          id: uuidVenta,
          user_id: user ? user.id : null,
          funcion_id: funcionId,
          monto_total: this.totalPagar(),
          descuento_aplicado: this.montoDescuento(),
          detalle_butacas: this.infoEntradas()?.butacas || [],
          detalle_candy: this.infoCandy()?.productos || [],
          codigo_qr: tokenQR // <-- Campo requerido por Supabase
        });

      if (error) {
        console.error('Error reportado por Supabase:', error);
        throw error;
      }

      this.codigoQR.set(tokenQR);
      this.compraFinalizada.set(true);

      setTimeout(() => {
        if (this.canvasQR) {
          QRCode.toCanvas(this.canvasQR.nativeElement, tokenQR, { width: 200 }, (err) => {
            if (err) console.error('Error al renderizar QR:', err);
          });
        }
      }, 100);

      localStorage.removeItem('entradas_seleccionadas');
      localStorage.removeItem('candy_seleccionado');
    } catch (err: any) {
      console.error('Error en procesarPago:', err);
      alert(`Ocurrió un error al procesar el pago: ${err.message || 'Error desconocido'}`);
    } finally {
      this.cargando.set(false);
    }
  }

  volverACartelera() {
    this.router.navigate(['/cartelera']);
  }
}