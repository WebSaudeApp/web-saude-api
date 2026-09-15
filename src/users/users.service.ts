import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { toUserResponse, UserResponseDto } from './dto/user-response.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveById(id: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null, isActive: true },
    });

    if (!user) {
      throw new UnauthorizedException('Sessão inválida.');
    }

    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });
  }

  async getProfile(id: string): Promise<UserResponseDto> {
    const user = await this.findActiveById(id);
    return toUserResponse(user);
  }

  async countActive(): Promise<number> {
    return this.prisma.user.count({
      where: { deletedAt: null },
    });
  }

  assertNotAdminRole(role: UserRole): void {
    if (role === UserRole.ADMIN) {
      throw new ConflictException(
        'Não é permitido cadastrar administrador por esta rota.',
      );
    }
  }
}
