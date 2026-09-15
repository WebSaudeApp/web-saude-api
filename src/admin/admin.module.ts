import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [SpecialtiesModule, AuditModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
