import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class EstabelecimentosExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(EstabelecimentosExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const details =
        typeof body === 'object' && body !== null
          ? (body as Record<string, unknown>)
          : undefined;

      if (status === 400 && Array.isArray(details?.erros)) {
        response.status(status).json(body);
        return;
      }

      if (status >= 500) {
        this.logServerError(request, status, exception);
        response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          status: 500,
          mensagem: 'Erro interno.',
        });
        return;
      }

      const message = details?.message;
      const mensagem = Array.isArray(message)
        ? message.join(' ')
        : typeof message === 'string'
          ? message
          : typeof body === 'string'
            ? body
            : 'Não foi possível concluir a solicitação.';

      response.status(status).json({
        status,
        mensagem:
          status === 429
            ? 'Muitas requisições. Tente novamente em instantes.'
            : mensagem,
      });
      return;
    }

    this.logServerError(request, HttpStatus.INTERNAL_SERVER_ERROR, exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      mensagem: 'Erro interno.',
    });
  }

  private logServerError(
    request: Request,
    status: number,
    exception: unknown,
  ): void {
    const message = `${request.method} ${request.path} ${status}`;
    this.logger.error(
      message,
      exception instanceof Error ? exception.stack : undefined,
    );
  }
}
