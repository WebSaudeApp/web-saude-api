import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';
import { HealthResponseDto, RootResponseDto } from './dto/health-response.dto';

@ApiTags('health')
@Public()
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Indica que a API está no ar' })
  @ApiOkResponse({ type: RootResponseDto })
  root(): RootResponseDto {
    return { message: 'api online' };
  }

  @Get('health')
  @SkipThrottle()
  @ApiOperation({ summary: 'Verifica se a API e o banco estão disponíveis' })
  @ApiOkResponse({ type: HealthResponseDto })
  async check(): Promise<HealthResponseDto> {
    const databaseConnected = await this.prisma.isDatabaseConnected();

    if (!databaseConnected) {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'disconnected',
      });
    }

    return {
      status: 'ok',
      database: 'connected',
    };
  }
}
