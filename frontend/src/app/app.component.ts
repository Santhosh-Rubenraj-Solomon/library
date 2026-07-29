import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NavBarComponent } from './shared/nav-bar/nav-bar.component';
import { NotificationsComponent } from './shared/notifications/notifications.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavBarComponent, NotificationsComponent],
  template: `
    <app-nav-bar />
    <main>
      <router-outlet />
    </main>
    <footer class="site-footer">
      <div class="container">
        <span>Surfboard Library</span>
        <span class="muted">Load-balanced across backend-1 / -2 / -3 via nginx</span>
      </div>
    </footer>
    <app-notifications />
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; min-height: 100vh; }
      main { flex: 1; }
      .site-footer {
        border-top: 1px solid var(--sl-border);
        padding: 22px 0;
        margin-top: 24px;
        font-size: 0.85rem;
      }
      .site-footer .container {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }
      .site-footer span:first-child { font-weight: 600; }
    `,
  ],
})
export class AppComponent {}
