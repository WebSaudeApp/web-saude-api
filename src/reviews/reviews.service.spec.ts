import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';
import { PaginacaoQueryDto } from '../common/dto/paginacao-query.dto';
import { PrismaService } from '../database/prisma.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const findUnique = jest.fn<(args: unknown) => Promise<unknown>>(() =>
    Promise.resolve({ id: 'estabelecimento-1' }),
  );
  const count = jest.fn<(args: unknown) => Promise<number>>(() =>
    Promise.resolve(0),
  );
  const findMany = jest.fn<(args: unknown) => Promise<unknown[]>>(() =>
    Promise.resolve([]),
  );
  const prisma = {
    estabelecimento: { findUnique },
    review: { count, findMany },
    $transaction: jest.fn((operations: Promise<unknown>[]) =>
      Promise.all(operations),
    ),
  } as unknown as PrismaService;
  const service = new ReviewsService(prisma);

  function review(id: string, criadoEm: string) {
    return {
      id,
      autorId: `autor-${id}`,
      estabelecimentoId: 'estabelecimento-1',
      nota: 5,
      comentario: `Comentário ${id}`,
      criadoEm: new Date(criadoEm),
      autor: { id: `autor-${id}`, nome: `Autor ${id}` },
      estabelecimento: { id: 'estabelecimento-1', nome: 'Hospital São João' },
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    findUnique.mockResolvedValue({ id: 'estabelecimento-1' });
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);
  });

  it('lista as avaliações da mais recente para a mais antiga, com nota, comentário, data e autor (A5)', async () => {
    count.mockResolvedValue(3);
    findMany.mockResolvedValue([
      review('3', '2026-10-03T10:00:00.000Z'),
      review('2', '2026-10-02T10:00:00.000Z'),
      review('1', '2026-10-01T10:00:00.000Z'),
    ]);

    const result = await service.listByEstabelecimento(
      'estabelecimento-1',
      new PaginacaoQueryDto(),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { estabelecimentoId: 'estabelecimento-1' },
        orderBy: { criadoEm: 'desc' },
      }),
    );
    expect(result.dados.map((item) => item.id)).toEqual(['3', '2', '1']);
    expect(result.dados[0]).toEqual({
      id: '3',
      nota: 5,
      comentario: 'Comentário 3',
      criadoEm: new Date('2026-10-03T10:00:00.000Z'),
      autor: { id: 'autor-3', nome: 'Autor 3' },
      estabelecimento: { id: 'estabelecimento-1', nome: 'Hospital São João' },
    });
  });

  it('pagina as avaliações com pagina e limite (A5, RN08)', async () => {
    count.mockResolvedValue(45);

    const result = await service.listByEstabelecimento(
      'estabelecimento-1',
      Object.assign(new PaginacaoQueryDto(), { pagina: 2, limite: 10 }),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(result.paginacao).toEqual({
      pagina: 2,
      limite: 10,
      total: 45,
      totalPaginas: 5,
    });
  });

  it('usa 20 avaliações por página como padrão (A5, RN08)', async () => {
    await service.listByEstabelecimento(
      'estabelecimento-1',
      new PaginacaoQueryDto(),
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('lança 404 quando o estabelecimento não existe mais (A5, E8)', async () => {
    findUnique.mockResolvedValue(null);

    await expect(
      service.listByEstabelecimento('nao-existe', new PaginacaoQueryDto()),
    ).rejects.toThrow(new NotFoundException('Estabelecimento não encontrado.'));
    expect(findMany).not.toHaveBeenCalled();
  });
});
