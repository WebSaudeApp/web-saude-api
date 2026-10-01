import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CriarEspecialidadeDto } from './dto/criar-especialidade.dto';
import { EspecialidadesService } from './especialidades.service';

@ApiTags('Especialidades')
@Controller('especialidades')
export class EspecialidadesController {
  constructor(private readonly especialidadesService: EspecialidadesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista especialidades' })
  list() {
    return this.especialidadesService.list();
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra uma especialidade' })
  create(@Body() dto: CriarEspecialidadeDto) {
    return this.especialidadesService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Renomeia uma especialidade' })
  update(@Param('id') id: string, @Body() dto: CriarEspecialidadeDto) {
    return this.especialidadesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove uma especialidade sem vínculos' })
  remove(@Param('id') id: string) {
    return this.especialidadesService.remove(id);
  }
}
