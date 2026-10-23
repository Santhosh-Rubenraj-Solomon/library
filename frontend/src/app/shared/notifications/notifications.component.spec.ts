import { TestBed } from '@angular/core/testing';

import { NotificationsComponent } from './notifications.component';
import { NotificationService } from '../../core/notification.service';

describe('NotificationsComponent', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders each toast with its kind class and dismisses on click', () => {
    const fixture = TestBed.createComponent(NotificationsComponent);
    const svc = TestBed.inject(NotificationService);
    svc.success('Saved');
    svc.error('Oops');
    fixture.detectChanges();

    const toasts = fixture.nativeElement.querySelectorAll('.toast') as NodeListOf<HTMLElement>;
    expect(toasts).toHaveLength(2);
    expect(toasts[0].classList).toContain('success');
    expect(toasts[1].classList).toContain('error');
    expect(toasts[1].textContent).toContain('Oops');

    (toasts[0].querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.toast')).toHaveLength(1);
    expect(svc.toasts()[0].message).toBe('Oops');
  });
});
