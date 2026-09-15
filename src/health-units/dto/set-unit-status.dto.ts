import { ApiProperty } from '@nestjs/swagger';
import { HealthUnitStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class SetUnitStatusDto {
  @ApiProperty({ enum: HealthUnitStatus })
  @IsEnum(HealthUnitStatus)
  status!: HealthUnitStatus;
}
