import type { Metadata, Viewport } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'controle-credito',
  description: 'Gestao de emprestimos pessoais',
};

/**
 * Viewport meta tag. Sem isso, mobile browsers renderizam a pagina com
 * largura desktop (980px) e dao zoom out - fica ilegivel. Next 16 ja'
 * gera o meta tag com `width=device-width, initialScale=1` por default
 * se nao exportar nada, mas deixamos explicito pra documentar a intencao.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a', // slate-900 - combina com o bg principal
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
