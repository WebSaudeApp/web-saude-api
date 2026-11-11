import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @ApiProperty({
    description: 'ID Token JWT gerado pelo Google OAuth no frontend',
    example: 'eyJhbGciOiJSUzI1NiIs...',
  })
  @IsString({ message: 'O idToken deve ser uma cadeia de caracteres.' })
  @IsNotEmpty({ message: 'O idToken é obrigatório.' })
  idToken!: string;
}
