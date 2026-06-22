import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'controle-credito',
  description: 'Gestao de emprestimos pessoais',
};

export default function RootLayout({ children }: { children: ReactNode }): ReactElement {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
