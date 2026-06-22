import { auth } from '@/auth';
import { NextResponse } from 'next/server';

/**
 * Middleware de protecao de rotas.
 *
 * - /login: rota publica (redireciona para /dashboard se ja' logado)
 * - /dashboard, /accounts/*, /loans/*, etc: rotas protegidas
 *   (redireciona para /login se nao autenticado)
 * - /api/auth/*: rotas do NextAuth (publicas)
 * - /, /_next/*, /favicon.ico: assets e landing
 *
 * NAO usamos o middleware nativo do NextAuth (auth()) porque queremos
 * controle explicito sobre quais paths sao publicos vs protegidos.
 */
export default auth((req: { auth: unknown; nextUrl: URL }) => {
  const { nextUrl } = req;
  const isLoggedIn = req.auth != null;
  const path = nextUrl.pathname;

  const isPublic =
    path === '/login' ||
    path === '/' ||
    path.startsWith('/api/auth') ||
    path.startsWith('/_next') ||
    path === '/favicon.ico';

  if (isPublic) {
    // Se ja' logado e tenta /login, redireciona para dashboard.
    if (isLoggedIn && path === '/login') {
      return NextResponse.redirect(new URL('/dashboard', nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL('/login', nextUrl);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

/**
 * Matcher: roda em todas as rotas EXCETO assets estaticos.
 * `_next` cobre os assets do Next; `favicon.ico` eh asset literal.
 */
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
