import { ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { UpdateEnderecoDto } from '../../common/dto/endereco.dto';
import { CriarUsuarioDto } from './criar-usuario.dto';

export class AtualizarUsuarioDto extends PartialType(
  OmitType(CriarUsuarioDto, ['endereco'] as const),
) {
  @ApiPropertyOptional({
    type: UpdateEnderecoDto,
    description:
      'Atualiza o endereço existente. Se o usuário ainda não tiver endereço, envie todos os campos obrigatórios.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateEnderecoDto)
  endereco?: UpdateEnderecoDto;
}
