import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';

import { AuthLayout } from 'src/layouts/auth';

import { renderFallback } from './shared';

// ----------------------------------------------------------------------
// Auth routes — all sign-in / register / password-reset flows, consolidated
// under /login. There is ONE sign-in page for everyone (/login): it reads the
// account's role after auth and routes to the right panel.
//   /login                       → unified sign-in (admin or buyer)
//   /login/register              → buyer registration
//   /login/forgot-password       → buyer password reset
//   /login/reset                 → set a new password (from reset email)
//   /login/admin                 → legacy alias, redirects to /login
//   /login/admin/forgot-password → owner password reset
// ----------------------------------------------------------------------

const SignInPage = lazy(() => import('src/pages/auth/sign-in'));
const AdminForgotPasswordPage = lazy(() => import('src/pages/auth/admin-forgot-password'));
const BuyerRegisterPage = lazy(() => import('src/pages/auth/buyer-register'));
const BuyerForgotPasswordPage = lazy(() => import('src/pages/auth/buyer-forgot-password'));
const ResetPasswordPage = lazy(() => import('src/pages/auth/reset-password'));

// Every auth page shares the same polished layout (logo header + centered
// card over a textured background).
const authShell = (element: React.ReactNode) => (
  <AuthLayout>
    <Suspense fallback={renderFallback()}>{element}</Suspense>
  </AuthLayout>
);

export const authRoutes: RouteObject[] = [
  // Single source of truth for sign-in.
  { path: 'login', element: authShell(<SignInPage />) },
  { path: 'login/register', element: authShell(<BuyerRegisterPage />) },
  { path: 'login/forgot-password', element: authShell(<BuyerForgotPasswordPage />) },
  { path: 'login/reset', element: authShell(<ResetPasswordPage />) },
  // Legacy admin sign-in URL → unified login.
  { path: 'login/admin', element: <Navigate to="/login" replace /> },
  { path: 'login/admin/forgot-password', element: authShell(<AdminForgotPasswordPage />) },
];
