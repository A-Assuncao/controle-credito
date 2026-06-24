import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Mensagem de email.
 *
 * from: opcional - cai em EMAIL_PROVIDER_FROM ou no default do provider.
 * subject: assunto (sem prefixo - caller decide).
 * text: corpo plain-text. SEMPRE fornecer - fallback se html nao renderiza.
 * html: corpo rich-text. Opcional mas recomendado pra links clicaveis.
 */
export interface EmailMessage {
  to: string;
  from?: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Interface de envio de email. Implementacoes concretas vivem em outros
 * arquivos (ConsoleEmailService, ProviderEmailService).
 *
 * Por que interface: testes podem injetar mock sem monkey-patch. E
 * a escolha do provider (Postmark, Resend, etc) fica isolada.
 */
export interface EmailService {
  send(msg: EmailMessage): Promise<void>;
}

/**
 * Implementacao para dev/test: loga no stdout. NAO envia email real.
 *
 * Formato de log: `[EMAIL] to=... subject=... text=...`
 * Inclui prefixo pra facilitar grep no CI/dev.
 */
export class ConsoleEmailService implements EmailService {
  async send(msg: EmailMessage): Promise<void> {
    // Log em varias linhas pra ficar legivel no terminal.
    logger.info(
      {
        to: msg.to,
        from: msg.from ?? env.EMAIL_PROVIDER_FROM,
        subject: msg.subject,
        text: msg.text,
        html: msg.html !== undefined,
      },
      '[EMAIL] (console - nao enviado de verdade)',
    );
  }
}

/**
 * Implementacao para prod: posta num provedor (Postmark, Resend, etc).
 *
 * Por enquanto eh' um stub: se nao tiver provider configurado, loga
 * warning e finge que enviou. A implementacao real (HTTP POST pra
 * API do provider) fica pra task separada quando o provider for
 * escolhido.
 *
 * Por que stub em vez de throw: se o provider nao tiver sido escolhido
 * ainda (env sem EMAIL_PROVIDER_API_KEY), nao queremos crashar a
 * aplicacao inteira. O recovery fluxo ainda funciona - o usuario
 * recebe o token via stdout em dev e o provider real eh' adicionado
 * depois.
 */
export class ProviderEmailService implements EmailService {
  async send(msg: EmailMessage): Promise<void> {
    logger.warn(
      {
        to: msg.to,
        subject: msg.subject,
        hasProviderKey: env.EMAIL_PROVIDER_API_KEY !== undefined,
      },
      '[EMAIL] (provider stub - nao enviado. Implementar Postmark/Resend em task separada.)',
    );
    // Nao lanca. Em prod, isso vai virar um POST HTTP.
  }
}

/**
 * Singleton - factory decide implementacao baseado no env.
 *
 * - Sem EMAIL_PROVIDER_API_KEY: ConsoleEmailService (dev/test default).
 * - Com EMAIL_PROVIDER_API_KEY: ProviderEmailService (prod).
 *
 * Isso permite o mesmo binario funcionar em dev e prod sem mudanca
 * de codigo - so' configuracao.
 */
export const emailService: EmailService = env.EMAIL_PROVIDER_API_KEY
  ? new ProviderEmailService()
  : new ConsoleEmailService();
