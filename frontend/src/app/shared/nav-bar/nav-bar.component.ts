import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="nav">
      <div class="container nav-inner">
        <a class="brand" routerLink="/catalog" aria-label="Surfboard Library home">
          <img class="mark" src="assets/surfboard-logo.png" alt="" width="34" height="34" />
          <span class="word">Surfboard<span class="thin">Library</span></span>
        </a>

        <nav class="links">
          <a routerLink="/catalog" routerLinkActive="active">Catalog</a>
          @if (auth.isLoggedIn()) {
            <a routerLink="/my-books" routerLinkActive="active">My books</a>
          }
          @if (auth.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active">Admin</a>
          }
        </nav>

        <div class="auth">
          @if (auth.isLoggedIn()) {
            <span class="who">
              <span class="email">{{ auth.user()?.mailId }}</span>
              @if (auth.isAdmin()) {
                <span class="badge role">admin</span>
              }
            </span>
            <button class="btn ghost sm" (click)="logout()">Sign out</button>
          } @else {
            <a class="btn sm" routerLink="/signin">Sign in</a>
          }
        </div>
      </div>
    </header>
  `,
  styles: [
    `
      .nav {
        position: sticky;
        top: 0;
        z-index: 50;
        background: color-mix(in srgb, var(--sl-surface) 82%, transparent);
        backdrop-filter: saturate(1.4) blur(10px);
        border-bottom: 1px solid var(--sl-border);
      }
      .nav-inner {
        display: flex;
        align-items: center;
        gap: 20px;
        height: 66px;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        color: var(--sl-ink);
        text-decoration: none;
        font-family: var(--sl-font-display);
      }
      .brand:hover { text-decoration: none; }
      .mark {
        width: 34px;
        height: 34px;
        object-fit: contain;
        display: block;
      }
      .word { font-size: 1.22rem; font-weight: 600; letter-spacing: -0.02em; }
      .word .thin { color: var(--sl-primary-strong); margin-left: 2px; }
      .links { display: flex; gap: 4px; margin-left: 8px; }
      .links a {
        color: var(--sl-muted);
        text-decoration: none;
        font-weight: 500;
        font-size: 0.94rem;
        padding: 8px 12px;
        border-radius: var(--sl-radius-sm);
        transition: color 0.15s, background 0.15s;
      }
      .links a:hover { color: var(--sl-ink); background: var(--sl-surface-sunk); }
      .links a.active { color: var(--sl-primary-strong); background: var(--sl-primary-soft); }
      .auth { display: flex; align-items: center; gap: 12px; margin-left: auto; }
      .who { display: inline-flex; align-items: center; gap: 8px; }
      .email {
        font-size: 0.85rem;
        color: var(--sl-muted);
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      @media (max-width: 640px) {
        .email { display: none; }
        .word .thin { display: none; }
      }
    `,
  ],
})
export class NavBarComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/catalog']);
  }
}
