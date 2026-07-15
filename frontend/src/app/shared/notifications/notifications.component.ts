import { Component, inject } from '@angular/core';

import { NotificationService } from '../../core/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  template: `
    <div class="toast-stack" role="status" aria-live="polite">
      @for (t of notifications.toasts(); track t.id) {
        <div class="toast" [class]="'toast ' + t.kind">
          <span>{{ t.message }}</span>
          <button type="button" aria-label="Dismiss" (click)="notifications.dismiss(t.id)">
            &times;
          </button>
        </div>
      }
    </div>
  `,
})
export class NotificationsComponent {
  readonly notifications = inject(NotificationService);
}
