import { handlers } from '@/auth';

/**
 * NextAuth v5 catch-all handler.
 *
 * Gerencia /api/auth/signin, /api/auth/signout, /api/auth/session, /api/auth/callback/*
 * O apps/web NAO usa a API de login do NextAuth - chama o apps/api diretamente.
 * Mas o NextAuth ainda eh util para:
 * - /api/auth/session (usado pelo useSession no client)
 * - /api/auth/signout (limpa cookies do NextAuth)
 */
export const { GET, POST } = handlers;
