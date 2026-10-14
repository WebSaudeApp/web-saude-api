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
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CriarReviewDto } from '../reviews/dto/criar-review.dto';
import { ReviewsService } from '../reviews/reviews.service';
import { AdicionarMidiaDto } from './dto/adicionar-midia.dto';
import { CriarEstabelecimentoDto } from './dto/criar-estabelecimento.dto';
import { BuscarEstabelecimentosDto } from './dto/buscar-estabelecimentos.dto';
import { DefinirHorariosDto } from './dto/definir-horarios.dto';
import { DefinirEspecialidadesDto } from './dto/definir-especialidades.dto';
import { AtualizarEstabelecimentoDto } from './dto/atualizar-estabelecimento.dto';
import { EstabelecimentosService } from './estabelecimentos.service';
import { MAX_IMAGE_SIZE_BYTES } from './midia.util';

@ApiTags('Estabelecimentos')
@Controller('estabelecimentos')
export class EstabelecimentosController {
  constructor(
    private readonly estabelecimentosService: EstabelecimentosService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Busca estabelecimentos com filtros e paginação' })
  search(@Query() query: BuscarEstabelecimentosDto) {
    return this.estabelecimentosService.search(query);
  }

  @Get('tipos')
  @ApiOperation({ summary: 'Lista os tipos de estabelecimento' })
  listTypes() {
    return this.estabelecimentosService.listTypes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um estabelecimento' })
  findOne(@Param('id') id: string) {
    return this.estabelecimentosService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um estabelecimento com endereço' })
  create(@Body() dto: CriarEstabelecimentoDto) {
    return this.estabelecimentosService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita um estabelecimento' })
  update(@Param('id') id: string, @Body() dto: AtualizarEstabelecimentoDto) {
    return this.estabelecimentosService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um estabelecimento e tudo que é dele' })
  remove(@Param('id') id: string) {
    return this.estabelecimentosService.remove(id);
  }

  @Put(':id/especialidades')
  @ApiOperation({ summary: 'Define as especialidades do estabelecimento' })
  setSpecialties(
    @Param('id') id: string,
    @Body() dto: DefinirEspecialidadesDto,
  ) {
    return this.estabelecimentosService.setSpecialties(id, dto);
  }

  @Put(':id/horarios')
  @ApiOperation({ summary: 'Define os horários de funcionamento' })
  setOpeningHours(@Param('id') id: string, @Body() dto: DefinirHorariosDto) {
    return this.estabelecimentosService.setOpeningHours(id, dto);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Lista as avaliações do estabelecimento' })
  listReviews(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.reviewsService.listByEstabelecimento(id, query);
  }

  @Post(':id/reviews')
  @ApiOperation({ summary: 'Avalia um estabelecimento' })
  createReview(@Param('id') id: string, @Body() dto: CriarReviewDto) {
    return this.reviewsService.create(id, dto);
  }

  @Post(':id/midias')
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
      properties: {
        file: { type: 'string', format: 'binary' },
        legenda: { type: 'string' },
      },
    },
  })
  @ApiOperation({ summary: 'Envia uma foto do estabelecimento' })
  addImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AdicionarMidiaDto,
  ) {
    return this.estabelecimentosService.addImage(id, file, dto);
  }

  @Delete(':id/midias/:midiaId')
  @ApiOperation({ summary: 'Remove uma foto do estabelecimento' })
  removeImage(@Param('id') id: string, @Param('midiaId') midiaId: string) {
    return this.estabelecimentosService.removeImage(id, midiaId);
  }
}
