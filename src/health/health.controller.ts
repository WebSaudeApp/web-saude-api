import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../database/prisma.service';
import { HealthResponseDto } from './dto/health-response.dto';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
