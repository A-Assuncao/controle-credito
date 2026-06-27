import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  type CreateProductSchema,
  CreateProductSchemaSchema,
  type ListProductSchemasQuery,
  ListProductSchemasQuerySchema,
  type ProductSchemaResource,
} from '@controle-credito/contracts';
import { CurrentAccount } from '../common/decorators/index.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { ProductSchemasService } from './product-schemas.service.js';

/**
 * Endpoints de product_schemas (versionamento de produto financeiro).
 *
 *   POST /product-schemas  - criar (status 'active', version 1)
 *   GET  /product-schemas  - listar do account
 *
 * AuthGuard global protege. accountId do JWT via @CurrentAccount().
 * RLS filtra no DB. Validacao Zod -> 422 com issues.
 * Auditoria via AuditLoggerInterceptor global.
 */
@Controller('product-schemas')
export class ProductSchemasController {
  constructor(private readonly service: ProductSchemasService) {}

  @Post()
  async create(
    @CurrentAccount() accountId: string,
    @Body(new ZodValidationPipe(CreateProductSchemaSchema)) body: CreateProductSchema,
  ): Promise<ProductSchemaResource> {
    return this.service.create(accountId, body);
  }

  @Get()
  async list(
    @CurrentAccount() accountId: string,
    @Query(new ZodValidationPipe(ListProductSchemasQuerySchema))
    query: ListProductSchemasQuery,
  ): Promise<ProductSchemaResource[]> {
    return this.service.list(accountId, query);
  }
}
