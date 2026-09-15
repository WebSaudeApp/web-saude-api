import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status!: 'ok' | 'error';

  @ApiProperty({
    example: 'connected',
    enum: ['connected', 'disconnected'],
  })
  database!: 'connected' | 'disconnected';
}
