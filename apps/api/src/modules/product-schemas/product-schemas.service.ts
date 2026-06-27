import { Injectable } from '@nestjs/common';
import type {
  CreateProductSchema,
  ListProductSchemasQuery,
  ProductSchemaResource,
} from '@controle-credito/contracts';
import { ProductSchemasRepository, type ProductSchemaRow } from './product-schemas.repository.js';

/**
 * Service para product_schemas (EXE-002.3b).
 *
 * Responsabilidades:
 * - chamar o repository dentro do account context
 * - mapear ProductSchemaRow (snake) -> ProductSchemaResource (camel)
 *
 * NAO faz validacao: ZodValidationPipe ja' validou no controller.
 * NAO faz audit: AuditLoggerInterceptor global grava POSTs.
 */
@Injectable()
export class ProductSchemasService {
  constructor(private readonly repo: ProductSchemasRepository) {}

  async create(accountId: string, input: CreateProductSchema): Promise<ProductSchemaResource> {
    const row = await this.repo.create(accountId, input);
    return this.toDto(row);
  }

  async list(accountId: string, query: ListProductSchemasQuery): Promise<ProductSchemaResource[]> {
    const rows = await this.repo.list(accountId, query);
    return rows.map((r) => this.toDto(r));
  }

  private toDto(row: ProductSchemaRow): ProductSchemaResource {
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      name: row.name,
      effectiveFrom:
        row.effective_from instanceof Date
          ? row.effective_from.toISOString().slice(0, 10)
          : String(row.effective_from),
      config: row.config,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
