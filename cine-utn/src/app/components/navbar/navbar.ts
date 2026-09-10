import { Component, inject } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './navbar.html'

})
export class NavbarComponent {
  authService = inject(AuthService);
  private location = inject(Location);
  private router = inject(Router);

  volver() {
    this.location.back();
  }

  async logout() {
    await this.authService.logout();
    this.router.navigate(['/login']);
  }
}