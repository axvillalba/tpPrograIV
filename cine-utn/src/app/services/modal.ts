import { Injectable, signal } from '@angular/core';

export type TipoModal = 'info' | 'success' | 'warning' | 'danger' | 'confirm' | 'prompt';

export interface ConfigModal {
  titulo: string;
  mensaje: string;
  tipo: TipoModal;
  textoConfirmar?: string;
  textoCancelar?: string;
  placeholder?: string;
  valorInicial?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ModalService {
  modalActual = signal<ConfigModal | null>(null);
  inputPrompt = signal<string>('');

  private resolver!: (valor: any) => void;

  alerta(
    mensaje: string,
    titulo: string = 'Cine UTN',
    tipo: 'info' | 'success' | 'warning' | 'danger' = 'info'
  ): Promise<void> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.modalActual.set({
        titulo,
        mensaje,
        tipo,
        textoConfirmar: 'Entendido',
      });
    });
  }

  confirmar(
    mensaje: string,
    titulo: string = 'Confirmar Acción',
    textoConfirmar: string = 'Confirmar',
    textoCancelar: string = 'Cancelar'
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.modalActual.set({
        titulo,
        mensaje,
        tipo: 'confirm',
        textoConfirmar,
        textoCancelar,
      });
    });
  }

  pedirTexto(
    mensaje: string,
    titulo: string = 'Ingresar Información',
    valorInicial: string = '',
    placeholder: string = 'Escribí acá...'
  ): Promise<string | null> {
    return new Promise((resolve) => {
      this.resolver = resolve;
      this.inputPrompt.set(valorInicial);
      this.modalActual.set({
        titulo,
        mensaje,
        tipo: 'prompt',
        textoConfirmar: 'Confirmar',
        textoCancelar: 'Cancelar',
        placeholder,
        valorInicial,
      });
    });
  }

  cerrarConResultado(resultado: any) {
    this.modalActual.set(null);
    if (this.resolver) {
      this.resolver(resultado);
    }
  }
}