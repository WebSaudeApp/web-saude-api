import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ReviewsService } from '../reviews/reviews.service';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { UsuariosService } from './usuarios.service';

@ApiTags('Usuários')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly reviewsService: ReviewsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuários com paginação' })
  list(@Query() query: PaginationQueryDto) {
    return this.usuariosService.list(query);
  }

  @Get('tipos')
  @ApiOperation({ summary: 'Lista os tipos de usuário' })
  listTypes() {
    return this.usuariosService.listTypes();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalha um usuário' })
  findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra um usuário' })
  create(@Body() dto: CriarUsuarioDto) {
    return this.usuariosService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita um usuário' })
  update(@Param('id') id: string, @Body() dto: AtualizarUsuarioDto) {
    return this.usuariosService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um usuário, seus contatos e avaliações' })
  remove(@Param('id') id: string) {
    return this.usuariosService.remove(id);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Lista as avaliações feitas pelo usuário' })
  reviews(@Param('id') id: string, @Query() query: PaginationQueryDto) {
    return this.reviewsService.listByAutor(id, query);
  }
}
