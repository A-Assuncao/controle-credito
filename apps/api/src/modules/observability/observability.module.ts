import { Module, type OnModuleInit, type OnApplicationBootstrap } from '@nestjs/common';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';
import { env } from '@controle-credito/infra';

/**
 * Modulo de observabilidade. Inicializa o OpenTelemetry SDK com auto-instrumentation
 * para HTTP, Express, pg, ioredis, etc.
 *
 * Em dev: traces vao para o endpoint OTLP configurado (se houver). Sem
 * endpoint, o SDK roda mas nao exporta (traces ficam no espaco).
 * Em prod: traces vao para o collector (honeycomb/jaeger/etc).
 *
 * Para desligar: setar OTEL_SDK_DISABLED=true.
 */
@Module({})
export class ObservabilityModule implements OnModuleInit, OnApplicationBootstrap {
  private sdk: NodeSDK | null = null;

  onModuleInit(): void {
    if (process.env['OTEL_SDK_DISABLED'] === 'true') return;

    const otlpEndpoint = env.OTEL_EXPORTER_OTLP_ENDPOINT;
    const traceExporter = otlpEndpoint
      ? new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` })
      : null;

    this.sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: 'controle-credito-api',
        [ATTR_SERVICE_VERSION]: '0.5.0-code',
        [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: env.NODE_ENV,
      }),
      ...(traceExporter != null ? { traceExporter } : {}),
      instrumentations: [
        getNodeAutoInstrumentations({
          // Desabilitamos fs para nao poluir o trace com leitura de arquivos.
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    try {
      this.sdk.start();
    } catch (err) {
      // SDK nao inicializou - app segue sem tracing.
      console.error('OpenTelemetry SDK failed to start:', err);
    }
  }

  onApplicationBootstrap(): void {
    // Flush antes de shutdown para nao perder traces in-flight.
    process.on('SIGTERM', () => {
      this.sdk?.shutdown().catch((err: unknown) => console.error('OTel shutdown error:', err));
    });
  }
}
