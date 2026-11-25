import { Component, untracked, signal, inject, effect, OnDestroy } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { AuthService } from './services/auth';
import { ListaEsperaService } from './services/lista-espera';
import { SupabaseService } from './services/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { ModalSistemaComponent } from './components/modal-sistema/modal-sistema';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ModalSistemaComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnDestroy {
  protected readonly title = signal('cine-utn');

  listaEsperaService = inject(ListaEsperaService);
  private authService = inject(AuthService);
  private supabaseService = inject(SupabaseService);
  private router = inject(Router);

  alertasCancelacion = signal<any[]>([]);
  private canalNotificaciones: RealtimeChannel | null = null;

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      untracked(() => {
        if (user) {
          this.listaEsperaService.iniciarEscuchaRealtime(user.id);
          this.iniciarEscuchaAlertas(user.id);
        } else {
          this.listaEsperaService.detenerEscuchaRealtime();
          this.detenerEscuchaAlertas();
        }
      });
    });
  }

  private async iniciarEscuchaAlertas(userId: string) {
    this.detenerEscuchaAlertas();

    // 1. Cargar notificaciones no leídas pendientes
    const { data } = await this.supabaseService.client
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', userId)
      .eq('leida', false)
      .order('created_at', { ascending: false });

    if (data) {
      this.alertasCancelacion.set(data);
    }

    // 2. Suscribirse en tiempo real a nuevas cancelaciones
    this.canalNotificaciones = this.supabaseService.client
      .channel(`notificaciones-user-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          const nueva = payload.new;
          if (nueva && !nueva['leida']) {
            this.alertasCancelacion.update(prev => [nueva, ...prev]);
          }
        }
      )
      .subscribe();
  }

  private detenerEscuchaAlertas() {
    if (this.canalNotificaciones) {
      this.supabaseService.client.removeChannel(this.canalNotificaciones);
      this.canalNotificaciones = null;
    }
    this.alertasCancelacion.set([]);
  }

  async marcarAlertaLeida(alertaId: string, irAPerfil: boolean = false) {
    await this.supabaseService.client
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', alertaId);

    this.alertasCancelacion.update(prev => prev.filter(a => a.id !== alertaId));

    if (irAPerfil) {
      this.router.navigate(['/perfil']);
    }
  }

  irAComprarTurnoEspera(funcionId: string) {
    this.router.navigate(['/seleccion-entradas', funcionId]);
  }

  ngOnDestroy() {
    this.detenerEscuchaAlertas();
  }
}