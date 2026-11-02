import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EspecialidadesController } from './especialidades.controller';
import { EspecialidadesService } from './especialidades.service';

@Module({
  imports: [DatabaseModule],
  controllers: [EspecialidadesController],
  providers: [EspecialidadesService],
  exports: [EspecialidadesService],
})
export class EspecialidadesModule {}
