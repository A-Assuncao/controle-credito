import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';

/**
 * Pagina de "esqueci minha senha".
 *
 * Fluxo:
 * 1. User digita email.
 * 2. POST /auth/forgot-password na API.
 * 3. API retorna 204 SEMPRE (anti-enumeracao).
 * 4. Mostramos mensagem generica: "Se o email existir, enviaremos um link."
 *
 * IMPORTANTE: nao validamos se o email existe client-side. A API eh
 * a unica fonte de verdade (anti-enumeracao server-side).
 *
 * Usa Server Action para simplicidade - chama API server-side.
 */
export default function ForgotPasswordPage(): ReactElement {
  async function requestReset(formData: FormData): Promise<void> {
    'use server';
    const email = String(formData.get('email') ?? '')
      .trim()
      .toLowerCase();

    // POST para a API. Mesmo se email invalido, redireciona com sent=1
    // (anti-enumeracao: mesma UI para email valido/invalido/inexistente).
    if (email !== '' && email.includes('@')) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      try {
        await fetch(`${apiUrl}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      } catch {
        // Ignora erros - a UI eh' a mesma de qualquer jeito.
      }
    }
    redirect('/forgot-password?sent=1');
  }

  // Mensagem generica sempre - nunca diferencia entre "email existe" e "nao existe".
  const sent = true;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-6 shadow">
        <h1 className="text-xl font-semibold">Esqueci minha senha</h1>

        {sent ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-700">
              Se o email existir em nossa base, enviaremos um link para redefinicao de senha.
              Verifique sua caixa de entrada (e o spam).
            </p>
            <p className="text-sm text-slate-500">
              O link expira em <strong>1 hora</strong>.
            </p>
            <a
              href="/login"
              className="block text-center text-sm text-blue-600 hover:text-blue-700"
            >
              Voltar para o login
            </a>
          </div>
        ) : (
          <form action={requestReset} className="space-y-4">
            <p className="text-sm text-slate-500">
              Digite seu email. Se existir, enviaremos um link de redefinicao.
            </p>

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

            <button
              type="submit"
              className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Enviar link de redefinicao
            </button>

            <a
              href="/login"
              className="block text-center text-sm text-blue-600 hover:text-blue-700"
            >
              Voltar para o login
            </a>
          </form>
        )}
      </div>
    </main>
  );
}
