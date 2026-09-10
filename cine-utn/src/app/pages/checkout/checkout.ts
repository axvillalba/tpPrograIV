import { Component, OnInit, signal, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as QRCode from 'qrcode';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css'
})
export class CheckoutComponent implements OnInit {
  @ViewChild('canvasQR') canvasQR!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ticketContainer') ticketContainer!: ElementRef<HTMLDivElement>;

  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private router = inject(Router);

  fechaActual = new Date();
  infoEntradas = signal<any>(null);
  infoCandy = signal<any>(null);

  // Estados para manejo de cupones
  codigoCuponInput = signal<string>('');
  porcentajeDescuento = signal<number>(0);
  cuponAplicado = signal<boolean>(false);
  nombreCuponAplicado = signal<string>('');

  compraFinalizada = signal<boolean>(false);
  codigoQR = signal<string>('');
  cargando = signal<boolean>(false);

  montoEntradas = computed(() => this.infoEntradas()?.montoEntradas || 0);
  montoCandy = computed(() => this.infoCandy()?.totalCandy || 0);
  subtotal = computed(() => this.montoEntradas() + this.montoCandy());

  // Cálculo del descuento basado en el porcentaje configurable de Supabase
  montoDescuento = computed(() => {
    return this.subtotal() * this.porcentajeDescuento();
  });

  totalPagar = computed(() => this.subtotal() - this.montoDescuento());

  async ngOnInit() {
    try {
      const entradas = localStorage.getItem('entradas_seleccionadas');
      const candy = localStorage.getItem('candy_seleccionado');

      if (!entradas) {
        this.router.navigate(['/cartelera']);
        return;
      }

      this.infoEntradas.set(JSON.parse(entradas));
      if (candy) this.infoCandy.set(JSON.parse(candy));

      await this.verificarYAutoAplicarPrimeraCompra();
    } catch (err) {
      console.error('Error al inicializar Checkout:', err);
    }
  }

  // Verifica si es la 1ra compra y aplica automáticamente el cupón "PRIMERACOMPRA"
  private async verificarYAutoAplicarPrimeraCompra() {
    try {
      const perfil = await this.authService.getPerfilActual();
      if (perfil) {
        const { data: ventas } = await this.supabaseService.client
          .from('ventas')
          .select('id')
          .eq('user_id', perfil.id);

        if (!ventas || ventas.length === 0) {
          // Intentar aplicar cupón dinámico PRIMERACOMPRA desde Supabase
          this.codigoCuponInput.set('PRIMERACOMPRA');
          await this.aplicarCupon();
        }
      }
    } catch (err) {
      console.warn('No se pudo verificar el historial de compras:', err);
    }
  }

async aplicarCupon() {
  const codigoInput = this.codigoCuponInput().trim().toUpperCase();
  if (!codigoInput) return;

  try {
    // 1. Consulta directa con coincidencia exacta limpia (.eq)
    const { data, error } = await this.supabaseService.client
      .from('cupones')
      .select('*')
      .eq('codigo', codigoInput)
      .eq('activo', true);

    // Logging de depuración en consola
    console.log('Respuesta de Supabase Cupones:', { data, error, buscando: codigoInput });

    if (error) {
      console.error('Error al consultar Supabase:', error);
      alert('Error de conexión con la base de datos de cupones.');
      return;
    }

    if (!data || data.length === 0) {
      alert('El código de cupón ingresado no existe o no está activo.');
      return;
    }

    const cupon = data[0];
    const perfil = await this.authService.getPerfilActual();

    // 2. Validar restricción para mayores de 50 años
    if (cupon.solo_mayores_50) {
      if (!perfil || !perfil.fecha_nacimiento) {
        alert('Este cupón es exclusivo para usuarios registrados mayores de 50 años.');
        return;
      }

      const fechaNac = new Date(perfil.fecha_nacimiento);
      const edad = new Date().getFullYear() - fechaNac.getFullYear();

      if (edad < 50) {
        alert('Este cupón es exclusivo para clientes mayores de 50 años.');
        return;
      }
    }

    // 3. Validar restricción de primera compra
    if (cupon.es_primera_compra && perfil) {
      const { data: ventas } = await this.supabaseService.client
        .from('ventas')
        .select('id')
        .eq('user_id', perfil.id);

      if (ventas && ventas.length > 0) {
        alert('El cupón de primera compra solo es válido para tu primer pedido.');
        return;
      }
    }

    // 4. Aplicar porcentaje exitosamente
    const porcentajeDec = Number(cupon.porcentaje_descuento) / 100;
    this.porcentajeDescuento.set(porcentajeDec);
    this.cuponAplicado.set(true);
    this.nombreCuponAplicado.set(cupon.codigo);
  } catch (err) {
    console.error('Error en aplicarCupon:', err);
    alert('Ocurrió un error inesperado al validar el cupón.');
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
          codigo_qr: tokenQR
        });

      if (error) throw error;

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

  async descargarPDF() {
    if (!this.ticketContainer) return;

    const elemento = this.ticketContainer.nativeElement;
    const html2pdfModule = await import('html2pdf.js');
    const html2pdf = html2pdfModule.default || html2pdfModule;

    const opciones = {
      margin: 8,
      filename: `Ticket-CineUTN-${this.codigoQR()}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    (html2pdf as any)().set(opciones).from(elemento).save();
  }

  imprimirTicket() {
    window.print();
  }

  volverACartelera() {
    this.router.navigate(['/cartelera']);
  }
}