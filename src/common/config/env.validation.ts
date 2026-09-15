import { randomBytes } from 'crypto';
import { plainToInstance, Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

function jwtSecret(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  return randomBytes(48).toString('base64url');
}

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

  @Transform(({ value }: { value: unknown }) => jwtSecret(value))
  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

  @Transform(({ value }: { value: unknown }) => jwtSecret(value))
  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.length > 0 ? value : '15m',
  )
  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.length > 0 ? value : '7d',
  )
  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES!: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const hasAccessSecret =
    typeof config.JWT_ACCESS_SECRET === 'string' &&
    config.JWT_ACCESS_SECRET.trim().length > 0;
  const hasRefreshSecret =
    typeof config.JWT_REFRESH_SECRET === 'string' &&
    config.JWT_REFRESH_SECRET.trim().length > 0;

  if (!hasAccessSecret || !hasRefreshSecret) {
    console.warn(
      'JWT_ACCESS_SECRET ou JWT_REFRESH_SECRET ausente; gerando segredos temporários.',
    );
  }

  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  process.env.JWT_ACCESS_SECRET = validated.JWT_ACCESS_SECRET;
  process.env.JWT_REFRESH_SECRET = validated.JWT_REFRESH_SECRET;
  process.env.JWT_ACCESS_EXPIRES = validated.JWT_ACCESS_EXPIRES;
  process.env.JWT_REFRESH_EXPIRES = validated.JWT_REFRESH_EXPIRES;

  return validated;
}
