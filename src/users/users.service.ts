import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../database/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { toUserResponse, UserResponseDto } from './dto/user-response.dto';

const BCRYPT_ROUNDS = 10;

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

  async updateProfile(
    user: AuthenticatedUser,
    dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const current = await this.findActiveById(user.id);
    const updated = await this.prisma.user.update({
      where: { id: current.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      },
    });
    return toUserResponse(updated);
  }

  async changePassword(
    user: AuthenticatedUser,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const current = await this.findActiveById(user.id);
    const passwordOk = await bcrypt.compare(
      dto.currentPassword,
      current.passwordHash,
    );
    if (!passwordOk) {
      throw new UnauthorizedException('Senha atual inválida.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da atual.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: current.id },
        data: { passwordHash },
      }),
      this.prisma.session.updateMany({
        where: {
          userId: current.id,
          revokedAt: null,
          NOT: { id: user.sessionId },
        },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { message: 'Senha atualizada.' };
  }

  async deleteAccount(
    user: AuthenticatedUser,
    dto: DeleteAccountDto,
  ): Promise<{ message: string }> {
    const current = await this.findActiveById(user.id);
    const passwordOk = await bcrypt.compare(dto.password, current.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Senha inválida.');
    }

    const anonymizedHash = await bcrypt.hash(
      randomBytes(32).toString('hex'),
      BCRYPT_ROUNDS,
    );

    await this.prisma.$transaction([
      this.prisma.favorite.deleteMany({ where: { userId: current.id } }),
      this.prisma.healthUnit.updateMany({
        where: { ownerId: current.id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.session.updateMany({
        where: { userId: current.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: current.id },
        data: {
          name: 'Conta encerrada',
          email: `deleted.${current.id}@invalid.local`,
          phone: '00000000000',
          passwordHash: anonymizedHash,
          emailVerified: false,
          isActive: false,
          deletedAt: new Date(),
        },
      }),
    ]);

    return { message: 'Conta encerrada.' };
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
