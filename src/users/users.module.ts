import { Module } from '@nestjs/common';
import { FavoritesModule } from '../favorites/favorites.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [FavoritesModule, ReviewsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
