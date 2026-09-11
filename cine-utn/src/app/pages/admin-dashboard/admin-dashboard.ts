import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css'
})
export class AdminDashboardComponent implements OnInit {
  private supabaseService = inject(SupabaseService);
  private authService = inject(AuthService);
  private router = inject(Router);

  pestanaActiva = signal<'peliculas' | 'salas' | 'candy' | 'cupones'>('peliculas');
  
  // Listados
  peliculas = signal<any[]>([]);
  salas = signal<any[]>([]);
  productosCandy = signal<any[]>([]);
  cupones = signal<any[]>([]);
  cargando = signal<boolean>(false);

  // Formulario de Película
  nuevaPelicula = signal({
    titulo: '',
    sinopsis: '',
    genero: '',
    duracion_minutos: 120,
    clasificacion: 'TP',
    poster_url: ''
  });

  async ngOnInit() {
    await this.cargarDatos();
  }

  async cargarDatos() {
    this.cargando.set(true);
    try {
      const [resPeli, resCandy, resCupones] = await Promise.all([
        this.supabaseService.client.from('peliculas').select('*'),
        this.supabaseService.client.from('productos_candy').select('*'),
        this.supabaseService.client.from('cupones').select('*')
      ]);

      if (resPeli.data) this.peliculas.set(resPeli.data);
      if (resCandy.data) this.productosCandy.set(resCandy.data);
      if (resCupones.data) this.cupones.set(resCupones.data);
    } catch (err) {
      console.error('Error cargando datos del dashboard:', err);
    } finally {
      this.cargando.set(false);
    }
  }

  async agregarPelicula() {
    const peli = this.nuevaPelicula();
    if (!peli.titulo || !peli.genero) {
      alert('Por favor, completá al menos el título y el género.');
      return;
    }

    const { error } = await this.supabaseService.client
      .from('peliculas')
      .insert(peli);

    if (error) {
      alert('Error al agregar película: ' + error.message);
    } else {
      alert('Película agregada con éxito.');
      this.nuevaPelicula.set({
        titulo: '', sinopsis: '', genero: '', duracion_minutos: 120, clasificacion: 'TP', poster_url: ''
      });
      await this.cargarDatos();
    }
  }

  async eliminarPelicula(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta película?')) return;

    const { error } = await this.supabaseService.client
      .from('peliculas')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error al eliminar: ' + error.message);
    } else {
      await this.cargarDatos();
    }
  }

  async cerrarSesion() {
    await this.authService.logout();
    this.router.navigate(['/login-staff']);
  }
}