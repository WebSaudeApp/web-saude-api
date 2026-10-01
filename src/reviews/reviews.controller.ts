import { Body, Controller, Delete, Param, Patch } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AtualizarReviewDto } from './dto/atualizar-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Avaliações')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Edita nota e comentário de uma avaliação' })
  update(@Param('id') id: string, @Body() dto: AtualizarReviewDto) {
    return this.reviewsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma avaliação' })
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
