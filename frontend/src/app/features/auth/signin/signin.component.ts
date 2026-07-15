import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../../core/auth.service';
import { NotificationService } from '../../../core/notification.service';

@Component({
  selector: 'app-signin',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="auth-shell">
      <section class="hero">
        <div class="hero-inner">
          <p class="eyebrow">Surf Library</p>
          <h1>Borrow good books.<br />Return the favour.</h1>
          <p class="lede">
            A small community library — browse the shelves, borrow what catches your
            eye, and bring it back for the next reader.
          </p>
          <ul class="ticks">
            <li>Browse and search the full catalog</li>
            <li>Borrow and return in one tap</li>
            <li>Keep track of what you've read</li>
          </ul>
        </div>
      </section>

      <section class="form-side">
        <form class="auth-card card pad" (ngSubmit)="submit()">
          <h2>Sign in</h2>
          <p class="muted sub">Enter your email to get a library card.</p>

          <div class="field">
            <label for="email">Email address</label>
            <input
              id="email"
              class="input"
              type="email"
              name="email"
              placeholder="you@example.com"
              autocomplete="email"
              [(ngModel)]="mailId"
              required
            />
          </div>

          <button class="btn block" type="submit" [disabled]="loading() || !mailId.trim()">
            @if (loading()) {
              <span class="spinner"></span> Signing in…
            } @else {
              Continue
            }
          </button>

          <p class="hint muted">
            Admin access is granted by the <code>seed:admin</code> script — sign in with
            the seeded admin email (default <code>admin&#64;surflibrary.dev</code>) to reach
            the admin screens.
          </p>
        </form>
      </section>
    </div>
  `,
  styles: [
    `
      .auth-shell {
        display: grid;
        grid-template-columns: 1.05fr 0.95fr;
        min-height: calc(100vh - 66px);
      }
      .hero {
        display: grid;
        align-items: center;
        color: #fff;
        background:
          radial-gradient(700px 320px at 20% 10%, rgba(255, 255, 255, 0.16), transparent 60%),
          linear-gradient(160deg, var(--sl-primary), var(--sl-primary-strong));
        padding: 48px;
      }
      .hero-inner { max-width: 460px; margin-left: auto; }
      .hero .eyebrow { color: rgba(255, 255, 255, 0.85); }
      .hero h1 {
        color: #fff;
        font-size: clamp(2rem, 3.6vw, 3rem);
        margin: 10px 0 18px;
      }
      .hero .lede { color: rgba(255, 255, 255, 0.9); font-size: 1.02rem; max-width: 42ch; }
      .ticks { list-style: none; padding: 0; margin: 26px 0 0; display: grid; gap: 10px; }
      .ticks li { position: relative; padding-left: 26px; color: rgba(255, 255, 255, 0.92); }
      .ticks li::before {
        content: '';
        position: absolute;
        left: 0;
        top: 7px;
        width: 12px;
        height: 7px;
        border-left: 2px solid #fff;
        border-bottom: 2px solid #fff;
        transform: rotate(-45deg);
      }
      .form-side { display: grid; place-items: center; padding: 40px 24px; }
      .auth-card { width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 16px; }
      .auth-card h2 { font-size: 1.6rem; }
      .sub { margin: -8px 0 4px; }
      .hint { font-size: 0.8rem; line-height: 1.5; }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        background: var(--sl-surface-sunk);
        padding: 1px 5px;
        border-radius: 5px;
        font-size: 0.85em;
      }
      @media (max-width: 860px) {
        .auth-shell { grid-template-columns: 1fr; }
        .hero { display: none; }
      }
    `,
  ],
})
export class SigninComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly notify = inject(NotificationService);

  mailId = '';
  readonly loading = signal(false);

  submit(): void {
    const email = this.mailId.trim();
    if (!email) return;
    this.loading.set(true);
    this.auth.signin(email).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.status === 'SUCCESS') {
          this.notify.success('Signed in successfully');
          const redirect = this.route.snapshot.queryParamMap.get('redirect') || '/catalog';
          this.router.navigateByUrl(redirect);
        } else {
          this.notify.error(res.message || 'Sign in failed');
        }
      },
      error: () => {
        this.loading.set(false);
        this.notify.error('Could not reach the API. Is the stack running on :8080?');
      },
    });
  }
}
