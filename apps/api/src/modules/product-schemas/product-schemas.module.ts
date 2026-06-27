import { Module } from '@nestjs/common';
import { ProductSchemasController } from './product-schemas.controller.js';
import { ProductSchemasService } from './product-schemas.service.js';
import { ProductSchemasRepository } from './product-schemas.repository.js';
import { IdentityModule } from '../identity/identity.module.js';

/**
 * Modulo de product_schemas (EXE-002.3b Sprint 3).
 *
 * Proximos modulos (contracts, payments) devem importar ProductSchemasModule
 * e usar ProductSchemasRepository para reidratar o ProductSchema congelado.
 */
@Module({
  imports: [IdentityModule],
  controllers: [ProductSchemasController],
  providers: [ProductSchemasService, ProductSchemasRepository],
  exports: [ProductSchemasService, ProductSchemasRepository],
})
export class ProductSchemasModule {}
