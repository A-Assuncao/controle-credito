import { z } from 'zod';

/**
 * Schemas Zod para parties (tomadores).
 * EXE-002.3 (Sprint 3): CRUD de tomadores.
 *
 * v1: campo `document` eh' texto livre. Validacao de CPF strict (modulo 11)
 * fica para v2 (master-plan secao 14.1 - PartyIdentifier com hash + ultimos
 * digitos).
 */

export const PartyStatusSchema = z.enum(['active', 'inactive', 'blocked']);
export type PartyStatus = z.infer<typeof PartyStatusSchema>;

/**
 * Schema de party (tomador) retornado pela API.
 */
export const PartySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  document: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  status: PartyStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Party = z.infer<typeof PartySchema>;

/**
 * Body para criar um tomador (POST /parties).
 * `accountId` NAO esta aqui - vem do JWT (sempre single-tenant).
 */
export const CreatePartySchema = z.object({
  name: z.string().min(1).max(200),
  document: z.string().max(20).optional(), // CPF/CNPJ (texto livre por agora)
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  notes: z.string().max(1000).optional(),
});
export type CreateParty = z.infer<typeof CreatePartySchema>;

/**
 * Query string para GET /parties (filtros + paginacao).
 */
export const ListPartiesQuerySchema = z.object({
  status: PartyStatusSchema.optional(),
  search: z.string().max(100).optional(), // busca por nome (LIKE)
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListPartiesQuery = z.infer<typeof ListPartiesQuerySchema>;
