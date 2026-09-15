import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';
import { SpecialtiesService } from './specialties.service';

@ApiTags('specialties')
@Controller('specialties')
export class SpecialtiesController {
  constructor(private readonly specialtiesService: SpecialtiesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Lista especialidades' })
  list() {
    return this.specialtiesService.list();
  }

  @Post()
  @ApiBearerAuth()
  @Roles(UserRole.FUNCTIONAL, UserRole.ADMIN)
  @ApiOperation({ summary: 'Cadastra uma especialidade' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSpecialtyDto,
  ) {
    this.specialtiesService.forbidPatient(user.role);
    return this.specialtiesService.create(dto);
  }
}
