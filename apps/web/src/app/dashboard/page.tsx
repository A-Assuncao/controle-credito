import type { ReactElement } from 'react';
import Link from 'next/link';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { signOut } from '@/auth';

/**
 * Dashboard placeholder.
 *
 * Mostra dados basicos do user (id, accountId, email). Em Sprint 2
 * sera o hub central - tomadores, emprestimos, cobrancas.
 *
 * Banner MFA: aparece quando mfaStatus !== 'verified'.
 *   - 'not_required': user nunca ativou MFA (banner amarelo)
 *   - 'pending'     : user ativou mas nao verificou nesta sessao (banner vermelho)
 *   - 'verified'    : sem banner
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
  const mfaStatus = user.mfaStatus ?? 'not_required';
  const showMfaBanner = mfaStatus !== 'verified';

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

      {showMfaBanner ? <MfaBanner status={mfaStatus} /> : null}

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

/**
 * Banner de MFA. Renderizado condicionalmente baseado em mfaStatus.
 *
 * Nota: o link vai para /mfa-setup que NAO existe ainda (Sprint 2).
 * Por enquanto, o click vai dar 404 - mas o banner ja' educa o user
 * sobre a opcao.
 */
function MfaBanner({ status }: { status: 'pending' | 'verified' | 'not_required' }): ReactElement {
  if (status === 'verified') return <></>;

  const isPending = status === 'pending';
  const variant = isPending
    ? 'border-red-300 bg-red-50 text-red-900'
    : 'border-amber-300 bg-amber-50 text-amber-900';
  const title = isPending ? 'MFA pendente' : 'Ative o MFA';
  const body = isPending
    ? 'Voce ativou o MFA nesta conta mas nao verificou o codigo TOTP nesta sessao. Algumas operacoes sensiveis vao pedir o codigo.'
    : 'Recomendamos ativar autenticacao em 2 fatores (TOTP). Protege contra roubo de sessao.';
  const cta = isPending ? 'Verificar agora' : 'Ativar MFA';

  return (
    <div className={`mb-6 rounded-lg border p-4 ${variant}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-sm">{body}</p>
        </div>
        <Link
          href="/mfa-setup"
          className="shrink-0 rounded border border-current px-3 py-1 text-sm font-medium hover:bg-white/50"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
