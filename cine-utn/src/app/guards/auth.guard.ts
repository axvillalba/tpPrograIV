import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Guard para acceso exclusivo de Administradores y Gerentes.
 * Protege /admin/dashboard.
 */
export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const perfil = await authService.getPerfilActual();

  if (perfil && (perfil.rol === 'gerente' || perfil.rol === 'admin')) {
    return true;
  }

  router.navigate(['/login-staff']);
  return false;
};

/**
 * Guard para acceso de Personal de Control y Operaciones (Staff).
 * Protege /empleado/validador para roles 'empleado', 'gerente' y 'admin'.
 */
export const staffGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const perfil = await authService.getPerfilActual();

  if (perfil && (perfil.rol === 'empleado' || perfil.rol === 'gerente' || perfil.rol === 'admin')) {
    return true;
  }

  router.navigate(['/login-staff']);
  return false;
};

/**
 * Guard para acceso de usuarios registrados autenticados.
 * Protege /perfil.
 */
export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const perfil = await authService.getPerfilActual();

  if (perfil) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
