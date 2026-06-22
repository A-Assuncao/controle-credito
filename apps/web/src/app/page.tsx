import { redirect } from 'next/navigation';
import { auth } from '@/auth';

/**
 * Landing page. Redireciona para /dashboard se logado, /login caso contrario.
 */
export default async function Page(): Promise<never> {
  const session = await auth();
  redirect(session?.user ? '/dashboard' : '/login');
}
