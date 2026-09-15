import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { firstValueFrom, Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ url?: string }>();
    const path = request.url?.split('?')[0] ?? '';
    if (
      path === '/docs' ||
      path.startsWith('/docs/') ||
      path === '/docs-json'
    ) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    try {
      const activated = await this.resolve(super.canActivate(context));
      return activated === true || isPublic === true;
    } catch (error) {
      if (isPublic) {
        return true;
      }
      throw error;
    }
  }

  private resolve(
    result: boolean | Promise<boolean> | Observable<boolean>,
  ): Promise<boolean> {
    if (result instanceof Observable) {
      return firstValueFrom(result);
    }
    return Promise.resolve(result);
  }
}
