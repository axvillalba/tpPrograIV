import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './auth.html',
  styleUrl: './auth.css'
})
export class AuthComponent {
  // Estado para alternar entre el modo de Login y Registro
  modoRegistro = signal<boolean>(false);
  
  // Manejo de mensajes de error o éxito
  mensajeError = signal<string | null>(null);
  cargando = signal<boolean>(false);

  authForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.authForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      // Campos requeridos por el cliente para el registro
      nombre: [''],
      apellido: [''],
      fechaNacimiento: [''],
      tipoSangre: ['O+'],
      colorOjos: [''],
      diasVacaciones: [14]
    });
  }

  toggleModo() {
    this.modoRegistro.update(v => !v);
    this.mensajeError.set(null);
    this.actualizarValidaciones();
  }

  private actualizarValidaciones() {
    const esRegistro = this.modoRegistro();
    const camposExtra = ['nombre', 'apellido', 'fechaNacimiento', 'colorOjos', 'diasVacaciones'];

    camposExtra.forEach(campo => {
      const control = this.authForm.get(campo);
      if (esRegistro) {
        control?.setValidators([Validators.required]);
      } else {
        control?.clearValidators();
      }
      control?.updateValueAndValidity();
    });
  }

  async onSubmit() {
  if (this.authForm.invalid) {
    this.mensajeError.set('Por favor, completa todos los campos requeridos correctamente.');
    return;
  }

  this.cargando.set(true);
  this.mensajeError.set(null);

  try {
    if (this.modoRegistro()) {
      const formValue = { ...this.authForm.value };
      if (formValue.fechaNacimiento) {
        formValue.fechaNacimiento = new Date(formValue.fechaNacimiento).toISOString().split('T')[0];
      }
      await this.authService.registrarUsuario(formValue);
      alert('¡Registro exitoso! Ya podés acceder con tu cuenta y disfrutar del 20% de descuento en tu primera compra.');
      this.toggleModo();
    } else {
      const { email, password } = this.authForm.value;
      const res = await this.authService.login(email, password);
      console.log('Login exitoso:', res);
      // Redirigir explícitamente a la cartelera
      await this.router.navigate(['/cartelera']);
    }
  } catch (error: any) {
    console.error('Error en auth:', error);
    this.mensajeError.set(error.message || 'Ocurrió un error inesperado al procesar la solicitud.');
  } finally {
    this.cargando.set(false);
  }
}

  ingresarComoAnonimo() {
    // Permitir continuar sin sesión iniciada según requerimiento del Mail 1
    this.router.navigate(['/cartelera']);
  }
}