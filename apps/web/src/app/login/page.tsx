import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { auth } from '@/auth';

/**
 * Pagina de login.
 *
 * Server Component com form action que chama signIn('credentials', ...).
 * O NextAuth v5 invoca o authorize() do Credentials Provider, que faz
 * POST /auth/login no apps/api.
 */
export default async function LoginPage(): Promise<ReactElement> {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  async function login(formData: FormData): Promise<void> {
    'use server';
    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    try {
      await signIn('credentials', {
        email,
        password,
        redirectTo: '/dashboard',
      });
    } catch (err) {
      // NextAuth v5 joga redirect errors quando signIn tem redirectTo.
      // Re-throw esses (sao esperados) mas captura outros.
      if (err instanceof Error && err.message.includes('NEXT_REDIRECT')) {
        throw err;
      }
      // Falha generica -> renderiza pagina de login com erro.
      // O ideal seria redirecionar com query param ?error=1, mas isso
      // requer refatorar para action separada que retorna estado.
      // Para Sprint 1, aceitamos que erros genericos viram 500.
      throw err;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={login} className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">controle-credito</h1>
        <p className="text-sm text-slate-500">Entre com email e senha.</p>

        <label className="block">
          <span className="block text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="block text-sm font-medium">Senha</span>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
