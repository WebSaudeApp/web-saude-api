import { ApiProperty } from '@nestjs/swagger';
import { PapelUsuario, StatusUsuario, Usuario } from '@prisma/client';

export class UsuarioRespostaDto {
  @ApiProperty({ example: 'c1f7a840-7e44-42f1-a1e4-8fbbcf8f830d' })
  id!: string;

  @ApiProperty({ example: 'Maria Silva' })
  nome!: string;

  @ApiProperty({ example: 'maria@email.com' })
  email!: string;

  @ApiProperty({ example: '81999998888', required: false, nullable: true })
  telefone?: string | null;

  @ApiProperty({ enum: PapelUsuario, example: PapelUsuario.PACIENTE })
  papel!: PapelUsuario;

  @ApiProperty({ enum: StatusUsuario, example: StatusUsuario.ATIVO })
  status!: StatusUsuario;

  @ApiProperty()
  criadoEm!: Date;
}

export class AuthTokensDto {
  @ApiProperty({
    description: 'Token de acesso JWT de curta duração',
    example: 'eyJhbGciOiJIUzI1NiIs...',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token de longa duração para renovação de sessão',
    example: 'a6b2c9d8e7...',
  })
  refreshToken!: string;

  @ApiProperty({
    description: 'Tempo de expiração do access token em segundos',
    example: 900,
  })
  expiresIn!: number;

  @ApiProperty({
    type: UsuarioRespostaDto,
    description: 'Dados públicos do usuário autenticado',
  })
  usuario!: UsuarioRespostaDto;
}

export function paraUsuarioResposta(usuario: Usuario): UsuarioRespostaDto {
  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone,
    papel: usuario.papel,
    status: usuario.status,
    criadoEm: usuario.criadoEm,
  };
}
