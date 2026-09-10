import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';
import { NavbarComponent } from '../../components/navbar/navbar';

interface Butaca {
  fila: string;
  columna: number;
  bloque: number;
  tipo: 'estandar' | 'discapacidad' | 'vip';
  ocupada: boolean;
  seleccionada: boolean;
  precio: number;
}

@Component({
  selector: 'app-seleccion-entradas',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './seleccion-entradas.html',
  styleUrl: './seleccion-entradas.css'
})
export class SeleccionEntradasComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);

  pelicula = signal<any>(null);
  funciones = signal<any[]>([]); // Lista con todas las funciones
  funcionSeleccionada = signal<any>(null); // Función activa elegida
  mapaButacas = signal<Butaca[]>([]);
  advertenciaEdad = signal<string | null>(null);

  filas = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

  butacasSeleccionadas = computed(() => this.mapaButacas().filter(b => b.seleccionada));
  montoTotal = computed(() => this.butacasSeleccionadas().reduce((acc, curr) => acc + curr.precio, 0));

  async ngOnInit() {
    const peliculaId = this.route.snapshot.paramMap.get('id');
    if (!peliculaId) return;

    await this.cargarPeliculaYFunciones(peliculaId);
    await this.validarEdadUsuario();
  }

  private async cargarPeliculaYFunciones(peliculaId: string) {
    // 1. Obtener Película
    const { data: p } = await this.supabaseService.client
      .from('peliculas')
      .select('*')
      .eq('id', peliculaId)
      .single();
    this.pelicula.set(p);

    // 2. Obtener TODAS las Funciones disponibles con datos de la sala
    const { data: fList } = await this.supabaseService.client
      .from('funciones')
      .select('*, salas(nombre)')
      .eq('pelicula_id', peliculaId)
      .order('horario_inicio', { ascending: true });

    if (fList && fList.length > 0) {
      this.funciones.set(fList);
      // Seleccionar por defecto la primera función
      this.seleccionarFuncion(fList[0]);
    }
  }

  async seleccionarFuncion(f: any) {
    this.funcionSeleccionada.set(f);
    this.generarMapaSalas();
    await this.cargarButacasOcupadas(f.id);
  }

  private async cargarButacasOcupadas(funcionId: string) {
    const { data: ventasExistentes } = await this.supabaseService.client
      .from('ventas')
      .select('detalle_butacas')
      .eq('funcion_id', funcionId);

    if (ventasExistentes && ventasExistentes.length > 0) {
      const asientosCompradosSet = new Set<string>();

      ventasExistentes.forEach((v: any) => {
        if (v.detalle_butacas && Array.isArray(v.detalle_butacas)) {
          v.detalle_butacas.forEach((b: any) => {
            asientosCompradosSet.add(`${b.fila}-${b.columna}`);
          });
        }
      });

      this.mapaButacas.update(asientos =>
        asientos.map(b => ({
          ...b,
          ocupada: asientosCompradosSet.has(`${b.fila}-${b.columna}`),
          seleccionada: false
        }))
      );
    }
  }

  private async validarEdadUsuario() {
    const perfil = await this.authService.getPerfilActual();
    const pelicula = this.pelicula();

    if (perfil && pelicula) {
      const fechaNac = new Date(perfil.fecha_nacimiento);
      const edad = new Date().getFullYear() - fechaNac.getFullYear();

      if (pelicula.clasificacion_edad === '+18' && edad < 18) {
        alert('Esta película es exclusiva para mayores de 18 años.');
        this.router.navigate(['/cartelera']);
      } else if (pelicula.clasificacion_edad === '+13' && edad < 18) {
        this.advertenciaEdad.set('Atención: Al ser menor de 18 años, deberás asistir acompañado por un adulto.');
      }
    }
  }

  private generarMapaSalas() {
    const precioBase = this.funcionSeleccionada()?.precio_base || 5000;
    const listado: Butaca[] = [];

    this.filas.forEach(fila => {
      const esDiscapacidad = fila === 'J' || fila === 'K';
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
}