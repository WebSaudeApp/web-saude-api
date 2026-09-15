import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { memoryStorage } from 'multer';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateHealthUnitDto } from './dto/create-health-unit.dto';
import { SearchHealthUnitsDto } from './dto/search-health-units.dto';
import { SetOpeningHoursDto } from './dto/set-opening-hours.dto';
import { SetSpecialtiesDto } from './dto/set-specialties.dto';
import { UpdateHealthUnitDto } from './dto/update-health-unit.dto';
import { HealthUnitsService } from './health-units.service';
import { MAX_IMAGE_SIZE_BYTES } from './images/unit-image.util';
import { FavoritesService } from '../favorites/favorites.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateReviewDto } from '../reviews/dto/create-review.dto';
import { ReviewsService } from '../reviews/reviews.service';

@ApiTags('health-units')
@Controller('health-units')
export class HealthUnitsController {
  constructor(
    private readonly healthUnitsService: HealthUnitsService,
    private readonly reviewsService: ReviewsService,
    private readonly favoritesService: FavoritesService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: 'Busca unidades publicadas com filtros e paginação',
  })
  search(@Query() query: SearchHealthUnitsDto) {
    return this.healthUnitsService.search(query);
  }

  @Get('mine')
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL)
  @ApiOperation({ summary: 'Lista as unidades do gestor autenticado' })
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.healthUnitsService.findMine(user);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Detalha uma unidade de saúde' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.healthUnitsService.findOne(id, user);
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL)
  @ApiOperation({ summary: 'Cadastra unidade em rascunho' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateHealthUnitDto,
  ) {
    return this.healthUnitsService.create(user, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL)
  @ApiOperation({ summary: 'Edita a própria unidade' })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateHealthUnitDto,
  ) {
    return this.healthUnitsService.update(user, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL)
  @ApiOperation({ summary: 'Remove a própria unidade (soft delete)' })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.healthUnitsService.remove(user, id);
  }

  @Put(':id/specialties')
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL)
  @ApiOperation({ summary: 'Define as especialidades da unidade' })
  setSpecialties(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetSpecialtiesDto,
  ) {
    return this.healthUnitsService.setSpecialties(user, id, dto);
  }

  @Put(':id/opening-hours')
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL)
  @ApiOperation({ summary: 'Define os horários de funcionamento' })
  setOpeningHours(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetOpeningHoursDto,
  ) {
    return this.healthUnitsService.setOpeningHours(user, id, dto);
  }

  @Get(':id/reviews')
  @Public()
  @ApiOperation({ summary: 'Lista as avaliações públicas da unidade' })
  listReviews(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.reviewsService.listByUnit(id, query);
  }

  @Post(':id/reviews')
  @ApiBearerAuth()
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Avalia uma unidade publicada' })
  createReview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.create(user, id, dto);
  }

  @Post(':id/favorite')
  @ApiBearerAuth()
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Adiciona a unidade aos favoritos' })
  addFavorite(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.favoritesService.add(user, id);
  }

  @Delete(':id/favorite')
  @ApiBearerAuth()
  @Roles(UserRole.PATIENT)
  @ApiOperation({ summary: 'Remove a unidade dos favoritos' })
  removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.favoritesService.remove(user, id);
  }

  @Post(':id/images')
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Envia uma imagem da unidade' })
  addImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.healthUnitsService.addImage(user, id, file);
  }

  @Patch(':id/images/:imageId/main')
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL)
  @ApiOperation({ summary: 'Define a imagem principal' })
  setMainImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.healthUnitsService.setMainImage(user, id, imageId);
  }

  @Delete(':id/images/:imageId')
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL)
  @ApiOperation({ summary: 'Remove uma imagem da unidade' })
  removeImage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.healthUnitsService.removeImage(user, id, imageId);
  }
}
