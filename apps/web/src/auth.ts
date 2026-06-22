import NextAuth, { type DefaultSession, type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { LoginRequestSchema } from '@controle-credito/contracts';

// Augment NextAuth types com accountId no user.
declare module 'next-auth' {
  interface User {
    accountId?: string;
  }
  interface Session {
    user: {
      id: string;
      accountId: string;
    } & DefaultSession['user'];
    accessToken?: string;
  }
}

/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * Fluxo:
 *  1. User submete email+senha em /login (Server Action).
 *  2. Server Action chama signIn('credentials', ...) que ativa o authorize() abaixo.
 *  3. authorize() faz POST /auth/login no apps/api. Em sucesso, retorna
 *     { accessToken, refreshToken } que sao armazenados no JWT do NextAuth.
 *  4. accountId e userId sao extraidos do JWT via decodificacao local.
 *
 * Decisao Sprint 1: NAO fazer refresh automatico. Quando access expira (15min),
 * o usuario precisa logar de novo. Sprint 2 adiciona refresh transparente.
 *
 * Decisao: NAO usar OAuth/email provider. Auth eh 100% email+senha contra
 * o proprio apps/api (argon2id). Single-user por conta (sem RBAC).
 */
export interface AuthSession extends DefaultSession {
  user: {
    id: string;
    accountId: string;
  } & DefaultSession['user'];
  accessToken?: string;
}

interface ApiLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  mfaRequired: boolean;
}

interface ApiRefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

const API_URL = process.env['API_URL'] ?? 'http://localhost:3001';

export const authConfig: NextAuthConfig = {
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      authorize: async (raw) => {
        const parsed = LoginRequestSchema.safeParse(raw);
        if (!parsed.success) return null;

        let res: Response;
        try {
          res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: parsed.data.email, password: parsed.data.password }),
          });
        } catch {
          return null;
        }
        if (!res.ok) return null;

        const body = (await res.json()) as ApiLoginResponse;
        return {
          id: '',
          accountId: '',
          accessToken: body.accessToken,
          refreshToken: body.refreshToken,
          expiresAt: Math.floor(Date.now() / 1000) + body.expiresIn,
        };
      },
    }),
  ],
  callbacks: {
    /**
     * Recebe o token atual e user (no login). No login, copia os tokens
     * do authorize() para o JWT do NextAuth. Em chamadas subsequentes,
     * faz refresh automatico se faltar <2min para expirar.
     */
    async jwt({ token, user }) {
      if (user != null) {
        const u = user as { accessToken?: string; refreshToken?: string; expiresAt?: number };
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.expiresAt = u.expiresAt;
        const decoded = decodeJwt(u.accessToken ?? '');
        token.userId = decoded.sub;
        token.accountId = decoded.account_id;
      }

      // Refresh automatico se faltar <2min para expirar.
      const expiresAt = typeof token.expiresAt === 'number' ? token.expiresAt : 0;
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt - now < 120 && typeof token.refreshToken === 'string') {
        const refreshed = await refreshAccessToken(
          token.refreshToken as string,
          token.userId as string,
        );
        if (refreshed != null) {
          token.accessToken = refreshed.accessToken;
          token.refreshToken = refreshed.refreshToken;
          token.expiresAt = refreshed.expiresAt;
          const decoded = decodeJwt(refreshed.accessToken);
          token.userId = decoded.sub;
          token.accountId = decoded.account_id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      const t = token as {
        userId?: string;
        accountId?: string;
        accessToken?: string;
      };
      session.user.id = t.userId ?? '';
      session.user.accountId = t.accountId ?? '';
      if (t.accessToken !== undefined) {
        session.accessToken = t.accessToken;
      }
      return session;
    },
  },
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextAuthResult = NextAuth(authConfig) as any;
export const handlers = nextAuthResult.handlers;
export const signIn = nextAuthResult.signIn;
export const signOut = nextAuthResult.signOut;
export const auth = nextAuthResult.auth;

interface DecodedJwt {
  sub: string;
  account_id: string;
  exp: number;
}

/**
 * Decodifica payload do JWT sem verificar assinatura.
 * Token vem do apps/api (valido); usamos apenas para ler sub/account_id.
 */
function decodeJwt(token: string): DecodedJwt {
  const parts = token.split('.');
  if (parts.length !== 3) return { sub: '', account_id: '', exp: 0 };
  const payload = parts[1];
  if (payload == null) return { sub: '', account_id: '', exp: 0 };
  try {
    const json: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof json !== 'object' || json == null) return { sub: '', account_id: '', exp: 0 };
    const o = json as Record<string, unknown>;
    return {
      sub: typeof o['sub'] === 'string' ? (o['sub'] as string) : '',
      account_id: typeof o['account_id'] === 'string' ? (o['account_id'] as string) : '',
      exp: typeof o['exp'] === 'number' ? (o['exp'] as number) : 0,
    };
  } catch {
    return { sub: '', account_id: '', exp: 0 };
  }
}

async function refreshAccessToken(
  refreshToken: string,
  userId: string,
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
} | null> {
  if (userId === '') return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken, userId }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as ApiRefreshResponse;
    return {
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + body.expiresIn,
    };
  } catch {
    return null;
  }
}
