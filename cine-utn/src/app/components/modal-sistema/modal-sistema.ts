import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalService } from '../../services/modal';

@Component({
  selector: 'app-modal-sistema',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (modalService.modalActual(); as modal) {
      <div class="cinema-modal-backdrop" (click)="onBackdropClick(modal.tipo)">
        <div class="cinema-modal-card" (click)="$event.stopPropagation()">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="cinema-modal-icon" [ngClass]="'icon-' + modal.tipo">
              @switch (modal.tipo) {
                @case ('success') { <i class="bi bi-check-circle-fill fs-4"></i> }
                @case ('danger') { <i class="bi bi-x-octagon-fill fs-4"></i> }
                @case ('warning') { <i class="bi bi-exclamation-triangle-fill fs-4"></i> }
                @case ('confirm') { <i class="bi bi-question-circle-fill fs-4"></i> }
                @case ('prompt') { <i class="bi bi-pencil-square fs-4"></i> }
                @default { <i class="bi bi-info-circle-fill fs-4"></i> }
              }
            </div>
            <h5 class="fw-bold text-white m-0">{{ modal.titulo }}</h5>
          </div>

          <p class="text-light opacity-75 small mb-3" style="white-space: pre-line;">
            {{ modal.mensaje }}
          </p>

          @if (modal.tipo === 'prompt') {
            <div class="mb-4">
              <input
                type="text"
                class="form-control bg-dark text-white border-secondary"
                [placeholder]="modal.placeholder || ''"
                [ngModel]="modalService.inputPrompt()"
                (ngModelChange)="modalService.inputPrompt.set($event)"
                (keyup.enter)="modalService.cerrarConResultado(modalService.inputPrompt())"
                autofocus
              />
            </div>
          }

          <div class="d-flex justify-content-end gap-2 mt-2">
            @if (modal.tipo === 'confirm' || modal.tipo === 'prompt') {
              <button
                type="button"
                class="btn btn-outline-light btn-sm px-3"
                (click)="modalService.cerrarConResultado(modal.tipo === 'confirm' ? false : null)"
              >
                {{ modal.textoCancelar || 'Cancelar' }}
              </button>
            }

            <button
              type="button"
              class="btn btn-danger-custom btn-sm px-4 fw-bold"
              (click)="confirmarModal(modal.tipo)"
            >
              {{ modal.textoConfirmar || 'Aceptar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .cinema-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(5, 5, 8, 0.82);
      backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      z-index: 2000;
      animation: fadeInModal 0.16s ease-out;
    }

    .cinema-modal-card {
      width: 100%;
      max-width: 440px;
      background: linear-gradient(180deg, #1a1820 0%, #121116 100%);
      border: 1px solid rgba(229, 9, 20, 0.45);
      border-radius: 16px;
      padding: 1.5rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75);
    }

    .cinema-modal-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .icon-success { background: rgba(25, 135, 84, 0.2); color: #2ecc71; }
    .icon-danger { background: rgba(229, 9, 20, 0.2); color: #ff4d5a; }
    .icon-warning, .icon-confirm { background: rgba(255, 193, 7, 0.18); color: #ffc107; }
    .icon-info, .icon-prompt { background: rgba(13, 202, 240, 0.18); color: #38bdf8; }

    @keyframes fadeInModal {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class ModalSistemaComponent {
  modalService = inject(ModalService);

  confirmarModal(tipo: string) {
    if (tipo === 'confirm') {
      this.modalService.cerrarConResultado(true);
    } else if (tipo === 'prompt') {
      this.modalService.cerrarConResultado(this.modalService.inputPrompt());
    } else {
      this.modalService.cerrarConResultado(undefined);
    }
  }

  onBackdropClick(tipo: string) {
    if (tipo !== 'confirm' && tipo !== 'prompt') {
      this.modalService.cerrarConResultado(undefined);
    }
  }
}