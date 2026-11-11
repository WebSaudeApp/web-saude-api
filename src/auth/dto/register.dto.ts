import { ApiProperty } from '@nestjs/swagger';
import { PapelUsuario } from '@prisma/client';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'Maria Silva',
    description: 'Nome completo do usuário',
  })
  @IsString({ message: 'O nome deve ser uma cadeia de caracteres.' })
  @MinLength(2, { message: 'O nome deve ter no mínimo 2 caracteres.' })
  @MaxLength(120, { message: 'O nome deve ter no máximo 120 caracteres.' })
  nome!: string;

  @ApiProperty({ example: 'maria@email.com', description: 'E-mail do usuário' })
  @IsEmail({}, { message: 'E-mail inválido.' })
  email!: string;

  @ApiProperty({
    example: '81999998888',
    description: 'Telefone ou celular com DDD',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'O telefone deve ser uma cadeia de caracteres.' })
  @MinLength(10, { message: 'O telefone deve ter no mínimo 10 dígitos.' })
  @MaxLength(20, { message: 'O telefone deve ter no máximo 20 dígitos.' })
  telefone?: string;

  @ApiProperty({
    example: 'senhaSegura123',
    description: 'Senha de acesso (mínimo 8 caracteres)',
  })
  @IsString({ message: 'A senha deve ser uma cadeia de caracteres.' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @MaxLength(72, { message: 'A senha deve ter no máximo 72 caracteres.' })
  senha!: string;

  @ApiProperty({
    enum: [PapelUsuario.PACIENTE, PapelUsuario.GESTOR],
    example: PapelUsuario.PACIENTE,
    description: 'Papel do usuário no cadastro (somente PACIENTE ou GESTOR)',
  })
  @IsIn([PapelUsuario.PACIENTE, PapelUsuario.GESTOR], {
    message: 'O cadastro aceita somente os papéis PACIENTE ou GESTOR.',
  })
  papel!: PapelUsuario;
}
