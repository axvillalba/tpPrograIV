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
  styleUrl: './checkout.css',
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

  // BENEFICIOS DE FIDELIZACIÓN (Premios Canjeados en el Perfil)
  beneficiosCanjeados = signal<any[]>([]);
  beneficioSeleccionado = signal<any>(null);

  compraFinalizada = signal<boolean>(false);
  codigoQR = signal<string>('');
  cargando = signal<boolean>(false);

  montoEntradas = computed(() => this.infoEntradas()?.montoEntradas || 0);
  montoCandy = computed(() => this.infoCandy()?.totalCandy || 0);
  subtotal = computed(() => this.montoEntradas() + this.montoCandy());

  // Descuento por código de cupón
  montoDescuento = computed(() => {
    return this.subtotal() * this.porcentajeDescuento();
  });

  // Descuento automático por premio canjeado con Puntos de Fidelización
  montoDescuentoRecompensa = computed(() => {
    const beneficio = this.beneficioSeleccionado();
    if (!beneficio) return 0;

    const tipoLower = (beneficio.tipo || '').toLowerCase();
    const nombreLower = (beneficio.nombre || '').toLowerCase();

    // Si es Entrada Gratis, bonifica el valor individual de 1 entrada
    if (tipoLower.includes('entrada') || nombreLower.includes('entrada')) {
      const cantButacas = this.infoEntradas()?.butacas?.length || 1;
      const precioEntradaIndividual = this.montoEntradas() / cantButacas;
      return precioEntradaIndividual || 0;
    }

    // Si es Combo o Producto de Candy gratis, bonifica el total acumulado en Candy
    if (tipoLower.includes('candy') || tipoLower.includes('combo') || nombreLower.includes('combo')) {
      return this.montoCandy();
    }

    return 0;
  });

  // Total final a pagar restando tanto cupones como recompensas aplicadas
  totalPagar = computed(() => {
    const total = this.subtotal() - this.montoDescuento() - this.montoDescuentoRecompensa();
    return total > 0 ? total : 0;
  });

  async ngOnInit() {
    try {
      const entradas = localStorage.getItem('entradas_seleccionadas');
      const candy = localStorage.getItem('candy_seleccionado');

      // Leer premios o beneficios previamente canjeados en el perfil
      const beneficios = JSON.parse(localStorage.getItem('beneficios_canjeados') || '[]');
      this.beneficiosCanjeados.set(beneficios);

      // Si el usuario tiene premios disponibles, auto-seleccionar el primero para bonificarlo
      if (beneficios.length > 0) {
        this.beneficioSeleccionado.set(beneficios[0]);
      }

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

  private async verificarYAutoAplicarPrimeraCompra() {
    try {
      const perfil = await this.authService.getPerfilActual();
      if (perfil) {
        const { data: ventas } = await this.supabaseService.client
          .from('ventas')
          .select('id')
          .eq('user_id', perfil.id);

        if (!ventas || ventas.length === 0) {
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
      const { data, error } = await this.supabaseService.client
        .from('cupones')
        .select('*')
        .eq('codigo', codigoInput)
        .eq('activo', true);

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
      const tokenQR = this.generarCodigoCorto();

      const funcionObj = this.infoEntradas()?.funcion;
      const funcionId = funcionObj?.id || null;
      const montoFinal = this.totalPagar();
      const descuentoTotal = this.montoDescuento() + this.montoDescuentoRecompensa();

      // 1. Guardar la Venta registrando el descuento total consolidado
      const { error } = await this.supabaseService.client.from('ventas').insert({
        id: uuidVenta,
        user_id: user ? user.id : null,
        funcion_id: funcionId,
        monto_total: montoFinal,
        descuento_aplicado: descuentoTotal,
        detalle_butacas: this.infoEntradas()?.butacas || [],
        detalle_candy: this.infoCandy()?.productos || [],
        codigo_qr: tokenQR,
      });

      if (error) throw error;

      // 2. Acumulación de Puntos de Fidelización según el total efectivamente abonado
      if (user?.id) {
        const puntosGanados = Math.floor(montoFinal);

        if (puntosGanados > 0) {
          const { data: perfilData } = await this.supabaseService.client
            .from('perfiles')
            .select('puntos_fidelidad')
            .eq('id', user.id)
            .maybeSingle();

          const saldoPrevio = perfilData?.puntos_fidelidad || 0;
          const nuevoSaldo = saldoPrevio + puntosGanados;

          await this.supabaseService.client
            .from('perfiles')
            .update({ puntos_fidelidad: nuevoSaldo })
            .eq('id', user.id);

          const tituloPeli = funcionObj?.peliculas?.titulo || 'Entradas y Candy';
          await this.supabaseService.client
            .from('movimientos_puntos')
            .insert([{
              usuario_id: user.id,
              cantidad: puntosGanados,
              motivo: `Acumulación por compra: ${tituloPeli}`,
              fecha: new Date().toISOString()
            }]);
        }
      }

      // 3. Remover el beneficio canjeado utilizado del localStorage
      if (this.beneficioSeleccionado()) {
        const idUsado = this.beneficioSeleccionado().id;
        const restantes = this.beneficiosCanjeados().filter((b: any) => b.id !== idUsado);
        localStorage.setItem('beneficios_canjeados', JSON.stringify(restantes));
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

  private generarCodigoCorto(): string {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Se omiten letras y números confusos como O, 0, I, 1
    let codigo = '';
    for (let i = 0; i < 6; i++) {
      codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return `UTN-${codigo}`; // Ejemplo: UTN-8X2K9P
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
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };
    (html2pdf as any)().set(opciones).from(elemento).save();
  }

  imprimirTicket() {
    window.print();
  }

  volverACartelera() {
    this.router.navigate(['/cartelera']);
  }

  formatearFechaFuncion(fechaRaw: string): string {
    if (!fechaRaw) return 'N/A';
    const fecha = new Date(fechaRaw);
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const diaNombre = dias[fecha.getDay()];
    const diaNum = String(fecha.getDate()).padStart(2, '0');
    const mesNum = String(fecha.getMonth() + 1).padStart(2, '0');
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    return `${diaNombre} ${diaNum}/${mesNum} ${horas}:${minutos} hs`;
  }
}