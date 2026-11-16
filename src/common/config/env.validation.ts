import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  MinLength,
  ValidateIf,
  validateSync,
} from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV!: NodeEnv;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  DIRECT_URL!: string;

  @IsString()
  @IsNotEmpty()
  CORS_ORIGINS!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_TTL_MS!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT!: number;

  @Transform(
    ({ value }: { value: unknown }) => value === true || value === 'true',
  )
  @IsBoolean()
  SWAGGER_ENABLED!: boolean;

  @IsString()
  @IsNotEmpty()
  ELASTICSEARCH_NODE!: string;

  // Segredo compartilhado com o proxy do front (BE-34). Obrigatorio em producao: sem ele,
  // todos os visitantes atras do proxy dividiriam um unico balde de rate limit.
  @ValidateIf(
    (o: EnvironmentVariables) =>
      o.NODE_ENV === NodeEnv.Production ||
      o.FRONTEND_PROXY_SECRET !== undefined,
  )
  @IsString()
  @MinLength(32)
  FRONTEND_PROXY_SECRET?: string;

  // Número de proxies confiáveis à frente da API (ex.: 1 no Render). Obrigatório em produção:
  // um valor errado torna o x-forwarded-for forjável ou junta todos num único balde.
  @ValidateIf(
    (o: EnvironmentVariables) =>
      o.NODE_ENV === NodeEnv.Production || o.TRUST_PROXY !== undefined,
  )
  @Matches(/^(false|\d+)$/)
  TRUST_PROXY?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_USERNAME?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_PASSWORD?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_API_KEY?: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validated;
}
