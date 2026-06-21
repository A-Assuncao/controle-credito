/**
 * Entry point do NestJS - esqueleto.
 * Conteudo real (modules, controllers, guards) entra na task 6.
 */
import 'reflect-metadata';
import { env } from '@controle-credito/infra';

console.log(`API placeholder. NODE_ENV=${env.NODE_ENV}, PORT_API=${env.PORT_API}`);
