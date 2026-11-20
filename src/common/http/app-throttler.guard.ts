import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  ThrottlerStorage,
} from '@nestjs/throttler';

/**
 * AppThrottlerGuard (BE-34 #59)
 *
 * Implementa rate limiting isolado por visitante real, mesmo atrás de proxies reversos
 * (Next.js server-side proxy ou balanceador de carga da hospedagem).
 *
 * Segurança contra spoofing:
 * - O IP informado no cabeçalho `x-frontend-visitor-ip` só é considerado caso a requisição
 *   venha acompanhada do segredo compartilhado (`x-frontend-proxy-secret` === FRONTEND_PROXY_SECRET).
 * - Clientes diretos sem o segredo compartilhado são rastreados exclusivamente pelo IP físico do socket
 *   (`req.socket.remoteAddress`), impedindo que invasores forjem `x-forwarded-for` para burlar o limite.
 */
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  private readonly logger = new Logger(AppThrottlerGuard.name);

  constructor(
    @InjectThrottlerOptions()
    options: ThrottlerModuleOptions,
    @InjectThrottlerStorage()
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(options, storageService, reflector);
  }

  private ultimoAvisoMs = 0;

  /** Aceita um IP válido ou uma lista "a, b" (usa o primeiro IP válido); senão, undefined. */
  private extrairIpVisitante(valor: string | undefined): string | undefined {
    if (typeof valor !== 'string') {
      return undefined;
    }
    return valor
      .split(',')
      .map((parte) => parte.trim())
      .find((parte) => isIP(parte) !== 0);
  }

  /** Segredo válido sem IP utilizável: o visitante cai no balde direto; avisa 1x por minuto. */
  private avisarIpInvalido(): void {
    const agora = Date.now();
    if (agora - this.ultimoAvisoMs < 60_000) {
      return;
    }
    this.ultimoAvisoMs = agora;
    this.logger.warn(
      'Requisição com X-Frontend-Proxy-Secret válido, mas sem X-Frontend-Visitor-IP utilizável: usando o limite direto. Verifique o proxy do front.',
    );
  }

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    await Promise.resolve();

    const headers = (req.headers ?? {}) as Record<string, string | undefined>;
    const proxySecret = this.configService.get<string>('FRONTEND_PROXY_SECRET');
    const incomingSecret = headers['x-frontend-proxy-secret'];

    // 1. Requisição do proxy do front com segredo compartilhado: o front informa o IP do
    //    visitante num cabeçalho PRÓPRIO, que ele sempre sobrescreve (nunca copia do cliente).
    //    Não usamos x-forwarded-for aqui: numa cadeia, a primeira entrada pode ter sido escrita
    //    pelo próprio visitante e as últimas são saltos internos.
    if (proxySecret && segredoConfere(incomingSecret, proxySecret)) {
      const clientIp = this.extrairIpVisitante(
        headers['x-frontend-visitor-ip'],
      );
      if (clientIp) {
        return `proxy:${clientIp}`;
      }
      this.avisarIpInvalido();
    }

    // 2. Conexão direta ou sem segredo de proxy válido:
    // usa req.ip, que o Express já resolve conforme `trust proxy` (TRUST_PROXY): atrás de um
    // balanceador confiável é o IP real do cliente; sem proxy confiável é o IP do socket.
    // O x-forwarded-for cru nunca é lido aqui, então não pode ser forjado para trocar a chave.
    const socket = req.socket as { remoteAddress?: string } | undefined;
    const directIp =
      (typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : undefined) ??
      socket?.remoteAddress ??
      '127.0.0.1';

    return `direct:${directIp}`;
  }
}

function segredoConfere(
  recebido: string | undefined,
  esperado: string,
): boolean {
  if (typeof recebido !== 'string') {
    return false;
  }
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}
