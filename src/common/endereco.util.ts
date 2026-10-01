import { Endereco, Prisma } from '@prisma/client';
import type { EnderecoDto, UpdateEnderecoDto } from './dto/endereco.dto';

export function toEnderecoCreate(dto: EnderecoDto): Prisma.EnderecoCreateInput {
  return {
    cep: dto.cep.replace(/\D/g, ''),
    logradouro: dto.logradouro.trim(),
    numero: dto.numero.trim(),
    complemento: dto.complemento?.trim() || null,
    bairro: dto.bairro?.trim() || null,
    cidade: dto.cidade.trim(),
    estado: dto.estado.trim().toUpperCase(),
    latitude: dto.latitude ?? null,
    longitude: dto.longitude ?? null,
  };
}

export function toEnderecoUpdate(
  dto: UpdateEnderecoDto,
): Prisma.EnderecoUpdateInput {
  const data: Prisma.EnderecoUpdateInput = {};
  if (dto.cep !== undefined) data.cep = dto.cep.replace(/\D/g, '');
  if (dto.logradouro !== undefined) data.logradouro = dto.logradouro.trim();
  if (dto.numero !== undefined) data.numero = dto.numero.trim();
  if (dto.complemento !== undefined)
    data.complemento = dto.complemento.trim() || null;
  if (dto.bairro !== undefined) data.bairro = dto.bairro.trim() || null;
  if (dto.cidade !== undefined) data.cidade = dto.cidade.trim();
  if (dto.estado !== undefined) data.estado = dto.estado.trim().toUpperCase();
  if (dto.latitude !== undefined) data.latitude = dto.latitude;
  if (dto.longitude !== undefined) data.longitude = dto.longitude;
  return data;
}

export function toEnderecoResponse(endereco: Endereco) {
  return {
    id: endereco.id,
    cep: endereco.cep,
    logradouro: endereco.logradouro,
    numero: endereco.numero,
    complemento: endereco.complemento,
    bairro: endereco.bairro,
    cidade: endereco.cidade,
    estado: endereco.estado,
    latitude: endereco.latitude,
    longitude: endereco.longitude,
  };
}
