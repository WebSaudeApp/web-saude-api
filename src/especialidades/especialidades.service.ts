import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CriarEspecialidadeDto } from './dto/criar-especialidade.dto';

@Injectable()
export class EspecialidadesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.especialidade.findMany({
      orderBy: { nome: 'asc' },
    });
  }

  async create(dto: CriarEspecialidadeDto) {
    try {
      return await this.prisma.especialidade.create({
        data: { nome: dto.nome.trim() },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async update(id: string, dto: CriarEspecialidadeDto) {
    await this.findOrThrow(id);
    try {
      return await this.prisma.especialidade.update({
        where: { id },
        data: { nome: dto.nome.trim() },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
    }
  }

  async remove(id: string) {
    await this.findOrThrow(id);
    const inUse = await this.prisma.estabelecimentoEspecialidade.count({
      where: { especialidadeId: id },
    });
    if (inUse > 0) {
      throw new ConflictException(
        'Não é possível remover especialidade vinculada a estabelecimentos.',
      );
    }
    return this.prisma.especialidade.delete({ where: { id } });
  }

  async assertIdsExist(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) {
      return;
    }
    const count = await this.prisma.especialidade.count({
      where: { id: { in: unique } },
    });
    if (count !== unique.length) {
      throw new NotFoundException('Uma ou mais especialidades não existem.');
    }
  }

  private async findOrThrow(id: string) {
    const especialidade = await this.prisma.especialidade.findUnique({
      where: { id },
    });
    if (!especialidade) {
      throw new NotFoundException('Especialidade não encontrada.');
    }
    return especialidade;
  }

  private rethrowDuplicate(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Especialidade já cadastrada.');
    }
    throw error;
  }
}
