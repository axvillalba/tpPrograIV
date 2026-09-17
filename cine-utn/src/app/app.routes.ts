import { Routes } from '@angular/router';
import { LoginStaffComponent } from './pages/login-staff/login-staff';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { 
    path: 'login', 
    loadComponent: () => import('./pages/auth/auth').then(m => m.AuthComponent) 
  },
  { 
    path: 'cartelera', 
    loadComponent: () => import('./pages/cartelera/cartelera').then(m => m.CarteleraComponent) 
  },
  // 1. Vista de Detalle (Poster, Sinopsis, Días y Horarios estilo Cinemark)
  { 
    path: 'pelicula/:id', 
    loadComponent: () => import('./pages/detalle-pelicula/detalle-pelicula').then(m => m.DetallePeliculaComponent) 
  },
  // 2. Vista de Selección de Butacas (Recibe la función seleccionada)
  { 
    path: 'seleccion-entradas/:id', 
    loadComponent: () => import('./pages/seleccion-entradas/seleccion-entradas').then(m => m.SeleccionEntradasComponent) 
  },
  { 
    path: 'candy', 
    loadComponent: () => import('./pages/candy/candy').then(m => m.CandyComponent) 
  },
  { 
    path: 'checkout', 
    loadComponent: () => import('./pages/checkout/checkout').then(m => m.CheckoutComponent) 
  },
  // --- RUTAS DEL PERSONAL (STAFF) ---
  { path: 'login-staff', component: LoginStaffComponent },
  { 
    path: 'admin/dashboard', 
    loadComponent: () => import('./pages/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent) 
  },
  /* 
  { 
    path: 'empleado/validador', 
    loadComponent: () => import('./pages/empleado-validador/empleado-validador').then(m => m.EmpleadoValidadorComponent) 
  }, 
  */
  { path: '**', redirectTo: 'login' }
];