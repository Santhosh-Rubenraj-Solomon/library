import { Routes } from '@angular/router';

import { authGuard, adminGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'catalog' },
  {
    path: 'signin',
    title: 'Sign in · Surfboard Library',
    loadComponent: () =>
      import('./features/auth/signin/signin.component').then((m) => m.SigninComponent),
  },
  {
    path: 'catalog',
    title: 'Catalog · Surfboard Library',
    loadComponent: () =>
      import('./features/catalog/catalog.component').then((m) => m.CatalogComponent),
  },
  {
    path: 'my-books',
    title: 'My books · Surfboard Library',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/my-books/my-books.component').then((m) => m.MyBooksComponent),
  },
  {
    path: 'admin',
    title: 'Admin · Surfboard Library',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/admin/admin.component').then((m) => m.AdminComponent),
  },
  { path: '**', redirectTo: 'catalog' },
];
