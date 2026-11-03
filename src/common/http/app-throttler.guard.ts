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
 * - O IP informado no cabeçalho `x-forwarded-for` só é considerado caso a requisição
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

  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    await Promise.resolve();

    const headers = (req.headers ?? {}) as Record<string, string | undefined>;
    const proxySecret = this.configService.get<string>('FRONTEND_PROXY_SECRET');
    const incomingSecret = headers['x-frontend-proxy-secret'];

    // 1. Requisição autenticada vinda do proxy do front-end com segredo compartilhado
    if (proxySecret && incomingSecret === proxySecret) {
      const forwardedFor = headers['x-forwarded-for'];
      if (typeof forwardedFor === 'string' && forwardedFor.trim().length > 0) {
        // Pega o primeiro IP (IP real de quem originou a requisição na borda)
        const clientIp = forwardedFor.split(',')[0].trim();
        if (clientIp) {
          return `proxy:${clientIp}`;
        }
      }
    }

    // 2. Conexão direta ou sem segredo de proxy válido:
    // Utiliza o IP físico do socket da conexão TCP para impedir que cabeçalhos x-forwarded-for forjados
    // alterem a chave de rate limit do invasor.
    const socket = req.socket as { remoteAddress?: string } | undefined;
    const directIp =
      socket?.remoteAddress ||
      (typeof req.ip === 'string' && req.ip.length > 0 ? req.ip : '127.0.0.1');

    return `direct:${directIp}`;
  }
}
