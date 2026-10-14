import { OmitType, PartialType } from '@nestjs/swagger';
import { CriarReviewDto } from './criar-review.dto';

export class AtualizarReviewDto extends PartialType(
  OmitType(CriarReviewDto, ['autorId'] as const),
) {}
