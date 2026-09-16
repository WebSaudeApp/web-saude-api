import { Body, Controller, Delete, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Avaliações')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Patch(':id')
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Edita a própria avaliação' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviewsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Remove a própria avaliação' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.reviewsService.remove(user, id);
  }
}
