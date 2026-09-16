import { Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../database/prisma.service';

function contentTypeFromBytes(bytes: Buffer): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return 'image/png';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

@ApiTags('Unidades de saúde')
@Public()
@SkipThrottle()
@Controller('unit-images')
export class UnitImagesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Serve o arquivo da imagem gravado no banco' })
  async file(
    @Param('id') id: string,
    @Res() response: Response,
  ): Promise<void> {
    const image = await this.prisma.unitImage.findUnique({
      where: { id },
      select: { bytes: true },
    });
    if (!image?.bytes) {
      throw new NotFoundException('Imagem não encontrada.');
    }
    const buffer = Buffer.from(image.bytes);
    response.setHeader('Content-Type', contentTypeFromBytes(buffer));
    response.setHeader('Cache-Control', 'public, max-age=86400');
    response.send(buffer);
  }
}
