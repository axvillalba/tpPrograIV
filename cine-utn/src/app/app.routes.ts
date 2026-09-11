import { Routes } from '@angular/router';
import { SeleccionEntradasComponent } from './pages/seleccion-entradas/seleccion-entradas';
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
  { path: 'seleccion-entradas/:id', component: SeleccionEntradasComponent },
  { path: 'login-staff', component: LoginStaffComponent },
  { 
    path: 'pelicula/:id', 
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
  { 
    path: 'admin/dashboard', 
    loadComponent: () => import('./pages/admin-dashboard/admin-dashboard').then(m => m.AdminDashboardComponent) 
  },
  // Dejamos lista la ruta para el Validador de QR del Empleado
  /* 
  { 
    path: 'empleado/validador', 
    loadComponent: () => import('./pages/empleado-validador/empleado-validador').then(m => m.EmpleadoValidadorComponent) 
  }, 
  */
  { path: '**', redirectTo: 'login' }
];