import type { ReactElement } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';

/**
 * Dashboard placeholder.
 *
 * Mostra dados basicos do user (id, accountId, email). Em Sprint 2
 * sera o hub central - tomadores, emprestimos, cobrancas.
 *
 * Server Component: renderizado no servidor, usa cookies de sessao.
 */
export default async function DashboardPage(): Promise<ReactElement> {
  const session = await auth();
  if (session?.user == null) {
    redirect('/login');
  }

  async function logout(): Promise<void> {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  const user = session.user;
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form action={logout}>
          <button
            type="submit"
            className="rounded border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
          >
            Sair
          </button>
        </form>
      </header>

      <section className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-3 text-sm font-medium text-slate-500">Conta</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">user_id</dt>
            <dd className="font-mono">{user.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">account_id</dt>
            <dd className="font-mono">{user.accountId}</dd>
          </div>
        </dl>
      </section>

      <p className="mt-6 text-xs text-slate-400">
        Sprint 1 / task 7. Conteudo completo (tomadores, emprestimos) vem na Sprint 2.
      </p>
    </main>
  );
}
