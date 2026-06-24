import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';

/**
 * Pagina de redefinicao de senha (rota publica, requer token na URL).
 *
 * Fluxo:
 * 1. User clica no link do email (ex: /reset-password?token=ABC...).
 * 2. Server-side: GET /auth/reset-password/validate?token=...
 * 3. Se valido: mostra form com email mascarado + input de nova senha.
 * 4. User submete nova senha -> Server Action -> POST /auth/reset-password.
 * 5. Sucesso: redireciona para /login com ?reset=1 (mostra mensagem).
 *
 * Seguranca:
 * - Email eh' mascarado (m***@e***.com) - nunca expor completo.
 * - Token vem da URL, validado server-side.
 * - Server Action chama API que valida o token novamente.
 * - Apos reset, user precisa logar de novo em todos devices.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}): Promise<ReactElement> {
  const params = await searchParams;
  const token = params.token;

  // Sem token: redireciona para forgot-password (UX defensiva).
  if (token == null || token.length < 20) {
    redirect('/forgot-password');
  }

  // Server-side: validar token antes de mostrar form.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  let validated = false;
  let emailMasked: string | undefined;

  try {
    const res = await fetch(
      `${apiUrl}/auth/reset-password/validate?token=${encodeURIComponent(token)}`,
      { cache: 'no-store' },
    );
    if (res.ok) {
      const data = (await res.json()) as { valid: boolean; email?: string };
      if (data.valid) {
        validated = true;
        emailMasked = data.email;
      }
    }
  } catch {
    // Network error - treated como invalid.
  }

  async function resetPassword(formData: FormData): Promise<void> {
    'use server';
    const submittedToken = String(formData.get('token') ?? '');
    const newPassword = String(formData.get('newPassword') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (newPassword !== confirmPassword) {
      redirect(`/reset-password?token=${submittedToken}&error=match`);
    }
    if (newPassword.length < 12) {
      redirect(`/reset-password?token=${submittedToken}&error=weak`);
    }

    const apiUrlReset = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const res = await fetch(`${apiUrlReset}/auth/reset-password`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: submittedToken, newPassword }),
    });

    if (!res.ok) {
      // Token invalido, expirado, ou rate limit.
      redirect(`/reset-password?token=${submittedToken}&error=invalid`);
    }

    // Sucesso - redireciona para login com mensagem.
    redirect('/login?reset=1');
  }

  if (!validated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
          <h1 className="text-xl font-semibold">Link invalido ou expirado</h1>
          <p className="text-sm text-slate-500">
            Este link de redefinicao nao eh' valido ou ja' expirou. Solicite um novo link abaixo.
          </p>
          <a
            href="/forgot-password"
            className="block text-center rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Solicitar novo link
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">Redefinir senha</h1>
        <p className="text-sm text-slate-500">
          Conta: <span className="font-mono">{emailMasked ?? '***'}</span>
        </p>

        <form action={resetPassword} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <label className="block">
            <span className="block text-sm font-medium">Nova senha</span>
            <input
              name="newPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-slate-400">
              Minimo 12 caracteres. Recomendamos combinar letras, numeros e simbolos.
            </span>
          </label>

          <label className="block">
            <span className="block text-sm font-medium">Confirmar nova senha</span>
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Redefinir senha
          </button>
        </form>
      </div>
    </main>
  );
}
