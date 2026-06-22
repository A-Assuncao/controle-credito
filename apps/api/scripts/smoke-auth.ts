/**
 * Script de smoke manual do pipeline de auth.
 *
 * Uso:
 *   pnpm exec tsx --env-file=../../.env scripts/smoke-auth.ts [accountId] [userId]
 *   Se accountId/userId nao fornecidos, gera UUIDs dummy.
 */
import { TokenService } from '../src/modules/identity/token/token.service.js';

async function main(): Promise<void> {
  const t = new TokenService();
  const accountId = process.argv[2] ?? '22222222-2222-2222-2222-222222222222';
  const userId = process.argv[3] ?? '11111111-1111-1111-1111-111111111111';

  const jwt = await t.sign({ sub: userId, account_id: accountId, mfa: 'not_required' });
  console.log('--- TOKEN ---');
  console.log(jwt);
  console.log('\n--- CURL EXEMPLO (do PowerShell) ---');
  console.log(`curl -sS -i -H "Authorization: Bearer ${jwt}" http://localhost:3001/health`);
  console.log('\n--- CURL EXEMPLO (do Ubuntu WSL, use 172.25.208.1) ---');
  console.log(`wsl curl -sS -i -H "Authorization: Bearer ${jwt}" http://172.25.208.1:3001/health`);
  console.log('\n--- COOKIE EXEMPLO ---');
  console.log(`curl -sS -i -H "Cookie: cc_session=${jwt}" http://localhost:3001/health`);
}

main().catch((err: unknown) => {
  console.error('ERRO:', err);
  process.exit(1);
});
