import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateSpecialtyDto } from './dto/create-specialty.dto';

@Injectable()
export class SpecialtiesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.specialty.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateSpecialtyDto) {
    try {
      return await this.prisma.specialty.create({
        data: { name: dto.name.trim() },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Especialidade já cadastrada.');
      }
      throw error;
    }
  }

  async assertIdsExist(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    const count = await this.prisma.specialty.count({
      where: { id: { in: ids } },
    });
    if (count !== ids.length) {
      throw new NotFoundException('Uma ou mais especialidades não existem.');
    }
  }

  forbidPatient(role: string): void {
    if (role === 'PATIENT') {
      throw new ForbiddenException('Pacientes não cadastram especialidades.');
    }
  }
}
