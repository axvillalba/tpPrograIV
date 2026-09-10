import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { NavbarComponent } from '../../components/navbar/navbar';

interface ProductoCandy {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  precio: number;
  imagen_url: string;
  cantidad?: number;
}

@Component({
  selector: 'app-candy',
  standalone: true,
  imports: [CommonModule, NavbarComponent],
  templateUrl: './candy.html',
  styleUrl: './candy.css'
})
export class CandyComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  productos = signal<ProductoCandy[]>([]);
  categoriaFiltro = signal<string>('Todos');
  
  // Guardamos el subtotal que viene de las entradas
  montoEntradas = signal<number>(0);

  categorias = ['Todos', 'Combos', 'Pochoclos', 'Bebidas'];

  productosFiltrados = computed(() => {
    const cat = this.categoriaFiltro();
    return cat === 'Todos' 
      ? this.productos() 
      : this.productos().filter(p => p.categoria === cat);
  });

  totalCandy = computed(() => {
    return this.productos().reduce((acc, p) => acc + (p.precio * (p.cantidad || 0)), 0);
  });

  // Cómputo del Total General (Entradas + Candy)
  totalGeneral = computed(() => this.montoEntradas() + this.totalCandy());

  async ngOnInit() {
    // Cargar lo que guardamos de las entradas seleccionadas
    const contextoEntradas = localStorage.getItem('entradas_seleccionadas');
    if (contextoEntradas) {
      const data = JSON.parse(contextoEntradas);
      this.montoEntradas.set(data.montoEntradas || 0);
    }

    const { data } = await this.supabaseService.client
      .from('productos_candy')
      .select('*')
      .eq('activo', true);

    if (data) {
      this.productos.set(data.map(p => ({ ...p, cantidad: 0 })));
    }
  }

  modificarCantidad(p: ProductoCandy, delta: number) {
    const nuevaCant = Math.max(0, (p.cantidad || 0) + delta);
    p.cantidad = nuevaCant;
    this.productos.update(arr => [...arr]);
  }

  continuarAlCheckout() {
    const seleccionados = this.productos().filter(p => (p.cantidad || 0) > 0);
    localStorage.setItem('candy_seleccionado', JSON.stringify({
      productos: seleccionados,
      totalCandy: this.totalCandy()
    }));
    this.router.navigate(['/checkout']);
  }
}