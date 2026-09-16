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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateSpecialtyDto } from '../specialties/dto/create-specialty.dto';
import { AdminService } from './admin.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { RejectUnitDto } from './dto/reject-unit.dto';
import { SetUserStatusDto } from './dto/set-user-status.dto';
import { UpdateSpecialtyDto } from './dto/update-specialty.dto';

@ApiTags('Administração')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly auditService: AuditService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Indicadores do painel administrativo' })
  dashboard() {
    return this.adminService.dashboard();
  }

  @Get('health-units/pending')
  @ApiOperation({ summary: 'Lista unidades aguardando aprovação' })
  pending() {
    return this.adminService.listPending();
  }

  @Patch('health-units/:id/approve')
  @ApiOperation({ summary: 'Aprova uma unidade pendente' })
  approve(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.adminService.approve(admin, id);
  }

  @Patch('health-units/:id/reject')
  @ApiOperation({ summary: 'Rejeita uma unidade pendente com motivo' })
  reject(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RejectUnitDto,
  ) {
    return this.adminService.reject(admin, id, dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'Lista usuários com filtros e paginação' })
  users(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Ativa ou desativa um usuário' })
  setUserStatus(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetUserStatusDto,
  ) {
    return this.adminService.setUserStatus(admin, id, dto);
  }

  @Post('specialties')
  @ApiOperation({ summary: 'Cadastra especialidade pelo painel admin' })
  createSpecialty(
    @CurrentUser() admin: AuthenticatedUser,
    @Body() dto: CreateSpecialtyDto,
  ) {
    return this.adminService.createSpecialty(admin, dto);
  }

  @Patch('specialties/:id')
  @ApiOperation({ summary: 'Renomeia uma especialidade' })
  updateSpecialty(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateSpecialtyDto,
  ) {
    return this.adminService.updateSpecialty(admin, id, dto);
  }

  @Delete('specialties/:id')
  @ApiOperation({ summary: 'Remove uma especialidade sem vínculos' })
  deleteSpecialty(
    @CurrentUser() admin: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.adminService.deleteSpecialty(admin, id);
  }

  @Get('audit')
  @ApiOperation({ summary: 'Lista logs de auditoria' })
  audit(@Query() query: PaginationQueryDto) {
    return this.auditService.list(query);
  }
}
