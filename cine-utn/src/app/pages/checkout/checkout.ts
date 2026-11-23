import { Component, OnInit, signal, computed, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import * as QRCode from 'qrcode';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { ListaEsperaService } from '../../services/lista-espera';
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
  private listaEsperaService = inject(ListaEsperaService);
  private router = inject(Router);

  fechaActual = new Date();
  infoEntradas = signal<any>(null);
  infoCandy = signal<any>(null);

  // Estados para manejo de cupones
  codigoCuponInput = signal<string>('');
  porcentajeDescuento = signal<number>(0);
  cuponAplicado = signal<boolean>(false);
  nombreCuponAplicado = signal<string>('');

  // BENEFICIOS DE FIDELIZACIÓN (Persistidos en Supabase: canjes_usuarios)
  beneficiosCanjeados = signal<any[]>([]);
  beneficioSeleccionado = signal<any>(null);

  // Perfil del usuario y manejo de Crédito a Favor
  perfilUsuario = signal<any>(null);
  usarCredito = signal<boolean>(false);

  compraFinalizada = signal<boolean>(false);
  codigoQR = signal<string>('');
  cargando = signal<boolean>(false);

  montoEntradas = computed(() => this.infoEntradas()?.montoEntradas || 0);
  montoCandy = computed(() => this.infoCandy()?.totalCandy || 0);
  subtotal = computed(() => this.montoEntradas() + this.montoCandy());

  creditoDisponible = computed(() => {
    return Number(this.perfilUsuario()?.credito_saldo) || 0;
  });

  clasificacionPelicula = computed(() => {
    return this.infoEntradas()?.pelicula?.clasificacion_edad || this.infoEntradas()?.pelicula?.clasificacion || 'ATP';
  });

  esPeliculaConRestriccion = computed(() => {
    const clasif = this.clasificacionPelicula();
    return clasif === '+13' || clasif === '+16' || clasif === '+18';
  });

  montoDescuento = computed(() => {
    return this.subtotal() * this.porcentajeDescuento();
  });

  montoDescuentoRecompensa = computed(() => {
    const beneficio = this.beneficioSeleccionado();
    if (!beneficio) return 0;

    const tipoLower = (beneficio.tipo || '').toLowerCase();
    const nombreLower = (beneficio.nombre || '').toLowerCase();

    if (tipoLower.includes('entrada') || nombreLower.includes('entrada')) {
      const cantButacas = this.infoEntradas()?.butacas?.length || 1;
      const precioEntradaIndividual = this.montoEntradas() / cantButacas;
      return precioEntradaIndividual || 0;
    }

    if (tipoLower.includes('candy') || tipoLower.includes('combo') || nombreLower.includes('combo')) {
      return this.montoCandy();
    }

    return 0;
  });

  montoCreditoAplicado = computed(() => {
    if (!this.usarCredito()) return 0;
    const remanente = this.subtotal() - this.montoDescuento() - this.montoDescuentoRecompensa();
    if (remanente <= 0) return 0;
    return Math.min(this.creditoDisponible(), remanente);
  });

  totalPagar = computed(() => {
    const total = this.subtotal() - this.montoDescuento() - this.montoDescuentoRecompensa() - this.montoCreditoAplicado();
    return total > 0 ? total : 0;
  });

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

      const perfil = await this.authService.getPerfilActual();
      if (perfil) {
        this.perfilUsuario.set(perfil);
        await this.cargarBeneficiosDisponibles(perfil.id);
      }

      await this.verificarYAutoAplicarPrimeraCompra();
    } catch (err) {
      console.error('Error al inicializar Checkout:', err);
    }
  }

  private async cargarBeneficiosDisponibles(userId: string) {
    const { data, error } = await this.supabaseService.client
      .from('canjes_usuarios')
      .select('*')
      .eq('usuario_id', userId)
      .eq('estado', 'disponible')
      .order('created_at', { ascending: true });

    if (!error && data) {
      this.beneficiosCanjeados.set(data);
      if (data.length > 0) {
        this.beneficioSeleccionado.set(data[0]);
      }
    }
  }

  private async verificarYAutoAplicarPrimeraCompra() {
    try {
      const perfil = this.perfilUsuario();
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
      const perfil = this.perfilUsuario();

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
    const funcionObj = this.infoEntradas()?.funcion;
    const funcionId = funcionObj?.id || null;

    try {
      const user = this.authService.currentUser();
      const uuidVenta = crypto.randomUUID();
      const tokenQR = this.generarCodigoCorto();

      const montoFinal = this.totalPagar();
      const descuentoTotal = this.montoDescuento() + this.montoDescuentoRecompensa() + this.montoCreditoAplicado();
      const creditoUsado = this.montoCreditoAplicado();
      const canjeId = this.beneficioSeleccionado()?.id || null;
      const tituloPeli = funcionObj?.peliculas?.titulo || 'Entradas y Candy';

      // Transacción atómica: valida disponibilidad real de butacas, registra venta, descuenta crédito, suma puntos y consume el canje
      const { error } = await this.supabaseService.client.rpc('registrar_venta_atomica', {
        p_venta_id: uuidVenta,
        p_user_id: user ? user.id : null,
        p_funcion_id: funcionId,
        p_monto_total: montoFinal,
        p_descuento_aplicado: descuentoTotal,
        p_detalle_butacas: this.infoEntradas()?.butacas || [],
        p_detalle_candy: this.infoCandy()?.productos || [],
        p_codigo_qr: tokenQR,
        p_credito_usado: creditoUsado,
        p_canje_id: canjeId,
        p_motivo_puntos: `Acumulación por compra: ${tituloPeli}`,
      });

      if (error) throw error;

      // Actualizar saldo local en memoria si se usó crédito
      if (user?.id && creditoUsado > 0) {
        const saldoRestante = Math.max(0, this.creditoDisponible() - creditoUsado);
        this.perfilUsuario.update(p => p ? { ...p, credito_saldo: saldoRestante } : null);
      }

      // Si compró usando su turno de Lista de Espera, cerrarlo y detener el cronómetro
      if (funcionId) {
        await this.listaEsperaService.marcarCompraCompletada(funcionId);
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
      const mensaje: string = err.message || 'Error desconocido';

      if (mensaje.includes('BUTACA_OCUPADA') && funcionId) {
        alert('⚠️ Una o más butacas elegidas acaban de ser compradas por otro cliente. Te llevamos nuevamente al mapa de sala para elegir otro asiento libre.');
        this.router.navigate(['/seleccion-entradas', funcionId]);
        return;
      }

      alert(`Ocurrió un error al procesar el pago: ${mensaje}`);
    } finally {
      this.cargando.set(false);
    }
  }

  private generarCodigoCorto(): string {
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = '';
    for (let i = 0; i < 6; i++) {
      codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return `UTN-${codigo}`;
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