import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { UsersService } from '../users/users.service';

@ApiTags('admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly usersService: UsersService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Indicadores iniciais do painel administrativo' })
  async dashboard(): Promise<{
    totalUnits: number;
    totalUsers: number;
    pendingUnits: number;
    recentReviews: unknown[];
  }> {
    const totalUsers = await this.usersService.countActive();
    return {
      totalUnits: 0,
      totalUsers,
      pendingUnits: 0,
      recentReviews: [],
    };
  }
}
