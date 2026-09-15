import { PartialType } from '@nestjs/swagger';
import { CreateHealthUnitDto } from './create-health-unit.dto';

export class UpdateHealthUnitDto extends PartialType(CreateHealthUnitDto) {}
