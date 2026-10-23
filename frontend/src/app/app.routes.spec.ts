import { routes } from './app.routes';
import { adminGuard, authGuard } from './core/guards';

describe('app routes', () => {
  const byPath = (p: string) => routes.find((r) => r.path === p)!;

  it('redirects the root and unknown paths to /catalog', () => {
    expect(byPath('')).toMatchObject({ redirectTo: 'catalog', pathMatch: 'full' });
    expect(byPath('**')).toMatchObject({ redirectTo: 'catalog' });
  });

  it('leaves catalog and signin public', () => {
    expect(byPath('catalog').canActivate).toBeUndefined();
    expect(byPath('signin').canActivate).toBeUndefined();
  });

  it('protects my-books with authGuard and admin with adminGuard', () => {
    expect(byPath('my-books').canActivate).toEqual([authGuard]);
    expect(byPath('admin').canActivate).toEqual([adminGuard]);
  });

  it.each([
    ['signin', 'SigninComponent'],
    ['catalog', 'CatalogComponent'],
    ['my-books', 'MyBooksComponent'],
    ['admin', 'AdminComponent'],
  ])('lazy-loads %s → %s', async (path, name) => {
    const cmp: any = await (byPath(path).loadComponent as () => Promise<any>)();
    expect(cmp.name).toBe(name);
  });
});
