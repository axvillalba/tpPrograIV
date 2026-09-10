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
  funcion = signal<any>(null);
  mapaButacas = signal<Butaca[]>([]);
  advertenciaEdad = signal<string | null>(null);

  filas = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T'];

  butacasSeleccionadas = computed(() => this.mapaButacas().filter(b => b.seleccionada));
  montoTotal = computed(() => this.butacasSeleccionadas().reduce((acc, curr) => acc + curr.precio, 0));

  async ngOnInit() {
    const peliculaId = this.route.snapshot.paramMap.get('id');
    if (!peliculaId) return;

    await this.cargarPeliculaYFuncion(peliculaId);
    await this.validarEdadUsuario();
    this.generarMapaSalas();
  }

  private async cargarPeliculaYFuncion(peliculaId: string) {
    const { data: p } = await this.supabaseService.client
      .from('peliculas')
      .select('*')
      .eq('id', peliculaId)
      .single();
    this.pelicula.set(p);

    const { data: f } = await this.supabaseService.client
      .from('funciones')
      .select('*')
      .eq('pelicula_id', peliculaId)
      .limit(1)
      .single();
    this.funcion.set(f);
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
    const precioBase = this.funcion()?.precio_base || 5000;
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

      for (let c = 1; c <= cantIzq; c++) {
        listado.push({ fila, columna: c, bloque: 1, tipo, ocupada: false, seleccionada: false, precio });
      }
      for (let c = 1; c <= cantCentro; c++) {
        listado.push({ fila, columna: c, bloque: 2, tipo, ocupada: false, seleccionada: false, precio });
      }
      for (let c = 1; c <= cantDer; c++) {
        listado.push({ fila, columna: c, bloque: 3, tipo, ocupada: false, seleccionada: false, precio });
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

  // <--- AGREGÁ LA FUNCIÓN ACÁ ---
  continuarAlCandy() {
    const entradas = this.butacasSeleccionadas();
    if (entradas.length === 0) return;

    localStorage.setItem('entradas_seleccionadas', JSON.stringify({
      pelicula: this.pelicula(),
      funcion: this.funcion(),
      butacas: entradas,
      montoEntradas: this.montoTotal()
    }));

    this.router.navigate(['/candy']);
  }
}