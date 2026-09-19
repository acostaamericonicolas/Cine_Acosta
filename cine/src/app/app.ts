import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);

  async salir() {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}