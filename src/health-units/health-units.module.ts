import { Module } from '@nestjs/common';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { HealthUnitsController } from './health-units.controller';
import { HealthUnitsService } from './health-units.service';

@Module({
  imports: [SpecialtiesModule],
  controllers: [HealthUnitsController],
  providers: [HealthUnitsService],
  exports: [HealthUnitsService],
})
export class HealthUnitsModule {}
