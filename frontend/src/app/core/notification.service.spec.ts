import { TestBed } from '@angular/core/testing';

import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let svc: NotificationService;

  beforeEach(() => {
    jest.useFakeTimers();
    svc = TestBed.inject(NotificationService);
  });

  afterEach(() => jest.useRealTimers());

  it('pushes toasts of each kind with increasing ids', () => {
    svc.success('ok');
    svc.error('bad');
    svc.info('fyi');
    expect(svc.toasts()).toEqual([
      { id: 1, kind: 'success', message: 'ok' },
      { id: 2, kind: 'error', message: 'bad' },
      { id: 3, kind: 'info', message: 'fyi' },
    ]);
  });

  it('dismiss removes only the given toast', () => {
    svc.info('a');
    svc.info('b');
    svc.dismiss(1);
    expect(svc.toasts().map((t) => t.message)).toEqual(['b']);
  });

  it('dismissing an unknown id is a no-op', () => {
    svc.info('a');
    svc.dismiss(99);
    expect(svc.toasts()).toHaveLength(1);
  });

  it('auto-dismisses each toast after 4.5s', () => {
    svc.info('first');
    jest.advanceTimersByTime(2000);
    svc.info('second');
    jest.advanceTimersByTime(2499);
    expect(svc.toasts()).toHaveLength(2);
    jest.advanceTimersByTime(1);
    expect(svc.toasts().map((t) => t.message)).toEqual(['second']);
    jest.advanceTimersByTime(2000);
    expect(svc.toasts()).toEqual([]);
  });
});
