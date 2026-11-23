import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

/**
 * Guard para acceso de Gerencia, Administradores y Roles Configurables.
 * Protege /admin/dashboard.
 */
export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const perfil = await authService.getPerfilActual();

  if (perfil && perfil.activo !== false && authService.tienePermisoAdmin(perfil)) {
    return true;
  }

  router.navigate(['/login-staff']);
  return false;
};

/**
 * Guard para acceso de Personal de Control y Operaciones (Staff).
 * Protege /empleado/validador.
 */
export const staffGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const perfil = await authService.getPerfilActual();

  if (
    perfil &&
    perfil.activo !== false &&
    (perfil.rol === 'empleado' || authService.tienePermisoAdmin(perfil))
  ) {
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

  if (perfil && perfil.activo !== false) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};