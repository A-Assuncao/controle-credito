/**
 * Gera um hash argon2id para inserir um user de teste no DB.
 * Uso: pnpm exec tsx --env-file=../../.env scripts/gen-hash.ts TestPassword123!
 */
import argon2 from 'argon2';

const plain = process.argv[2] ?? 'TestPassword123!';
argon2
  .hash(plain, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  })
  .then((h) => console.log(h))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
