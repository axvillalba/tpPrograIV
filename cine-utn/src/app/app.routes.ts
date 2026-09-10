import { Routes } from '@angular/router';

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
  { path: '**', redirectTo: 'login' }
];