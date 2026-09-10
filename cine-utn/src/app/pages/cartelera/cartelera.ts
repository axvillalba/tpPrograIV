import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PeliculasService, Pelicula } from '../../services/peliculas';
import { NavbarComponent } from '../../components/navbar/navbar';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule, FormsModule, NavbarComponent], // <-- Asegúrate de incluir NavbarComponent aquí
  templateUrl: './cartelera.html', // O './cartelera.component.html' según el nombre exacto de tu archivo
  styleUrl: './cartelera.css'
})
export class CarteleraComponent implements OnInit {
  listaPeliculas = signal<Pelicula[]>([]);
  masVendidas = signal<Pelicula[]>([]);
  
  busquedaTexto = signal<string>('');
  generoSeleccionado = signal<string>('Todos');

  generosDisponibles = ['Todos', 'Acción', 'Aventura', 'Comedia', 'Drama', 'Ciencia Ficción', 'Animación'];

  peliculasFiltradas = computed(() => {
    const texto = this.busquedaTexto().toLowerCase();
    const genero = this.generoSeleccionado();

    return this.listaPeliculas().filter(p => {
      const coincideTexto = p.titulo.toLowerCase().includes(texto) || p.sinopsis.toLowerCase().includes(texto);
      const coincideGenero = genero === 'Todos' || (p.generos && p.generos.includes(genero));
      return coincideTexto && coincideGenero;
    });
  });

  constructor(
    private peliculasService: PeliculasService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      const todas = await this.peliculasService.obtenerPeliculas();
      const destacadas = await this.peliculasService.obtenerMasVendidas();
      this.listaPeliculas.set(todas || []);
      this.masVendidas.set(destacadas || []);
    } catch (err) {
      console.error('Error al cargar cartelera:', err);
    }
  }

  // Método requerido por el template HTML para la navegación
  verDetallePelicula(id: string) {
    this.router.navigate(['/pelicula', id]);
  }
}