import { ApiProperty } from '@nestjs/swagger';
import { ContactType } from '@prisma/client';
import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';

export class ContactDto {
  @ApiProperty({ enum: ContactType, example: ContactType.TELEFONE })
  @IsEnum(ContactType)
  type!: ContactType;

  @ApiProperty({ example: '(81) 3333-4444' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  value!: string;
}
