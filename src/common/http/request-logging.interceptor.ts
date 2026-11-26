import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { sanitizarRotaLog } from './redact-log';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();
    const rota = sanitizarRotaLog(request);

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${request.method} ${rota} ${response.statusCode} ${Date.now() - startedAt}ms`,
          );
        },
        error: () => {
          this.logger.warn(
            `${request.method} ${rota} failed ${Date.now() - startedAt}ms`,
          );
        },
      }),
    );
  }
}
