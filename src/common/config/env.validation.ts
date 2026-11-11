import { randomBytes } from 'crypto';
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

  @IsString()
  @IsOptional()
  ELASTICSEARCH_USERNAME?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_PASSWORD?: string;

  @IsString()
  @IsOptional()
  ELASTICSEARCH_API_KEY?: string;

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET!: string;

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

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_ID?: string;

  @IsString()
  @IsOptional()
  GOOGLE_CLIENT_SECRET?: string;
}

export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const mergedConfig = { ...config };
  if (!mergedConfig.JWT_ACCESS_SECRET) {
    mergedConfig.JWT_ACCESS_SECRET = randomBytes(32).toString('hex');
  }
  if (!mergedConfig.JWT_REFRESH_SECRET) {
    mergedConfig.JWT_REFRESH_SECRET = randomBytes(32).toString('hex');
  }
  if (!mergedConfig.JWT_ACCESS_EXPIRES) {
    mergedConfig.JWT_ACCESS_EXPIRES = '15m';
  }
  if (!mergedConfig.JWT_REFRESH_EXPIRES) {
    mergedConfig.JWT_REFRESH_EXPIRES = '7d';
  }

  const validated = plainToInstance(EnvironmentVariables, mergedConfig, {
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
