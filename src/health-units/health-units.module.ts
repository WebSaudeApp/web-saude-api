import { Module } from '@nestjs/common';
import { FavoritesModule } from '../favorites/favorites.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { SpecialtiesModule } from '../specialties/specialties.module';
import { HealthUnitsController } from './health-units.controller';
import { HealthUnitsService } from './health-units.service';
import { UnitImagesController } from './unit-images.controller';

@Module({
  imports: [SpecialtiesModule, ReviewsModule, FavoritesModule],
  controllers: [HealthUnitsController, UnitImagesController],
  providers: [HealthUnitsService],
  exports: [HealthUnitsService],
})
export class HealthUnitsModule {}
