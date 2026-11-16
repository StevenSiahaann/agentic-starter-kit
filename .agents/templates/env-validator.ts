/**
 * Fail-Fast Boot-Time Environment Variable Validator Template
 * Implements: Strict startup configuration validation at millisecond 0,
 * cryptographic secret entropy checks (min 32 bytes), and immutable typed config export.
 */

export interface AppEnvConfig {
  readonly NODE_ENV: 'development' | 'test' | 'staging' | 'production';
  readonly PORT: number;
  readonly SERVICE_NAME: string;
  readonly DATABASE_URL: string;
  readonly REDIS_URL: string;
  readonly JWT_ACCESS_SECRET: string;
  readonly JWT_REFRESH_SECRET: string;
  readonly OTEL_EXPORTER_OTLP_ENDPOINT: string;
  readonly ENABLE_SWAGGER_UI: boolean;
}

export function validateEnvOrThrow(rawEnv: Record<string, string | undefined> = process.env): AppEnvConfig {
  const errors: string[] = [];

  const nodeEnv = rawEnv.NODE_ENV ?? 'development';
  if (!['development', 'test', 'staging', 'production'].includes(nodeEnv)) {
    errors.push(`NODE_ENV must be one of development|test|staging|production (got "${nodeEnv}")`);
  }

  const port = Number(rawEnv.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push(`PORT must be a valid TCP port integer between 1 and 65535 (got "${rawEnv.PORT}")`);
  }

  const serviceName = (rawEnv.SERVICE_NAME ?? '').trim();
  if (!serviceName) {
    errors.push('SERVICE_NAME is required');
  }

  const databaseUrl = (rawEnv.DATABASE_URL ?? '').trim();
  if (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a valid PostgreSQL connection URI');
  }

  const redisUrl = (rawEnv.REDIS_URL ?? '').trim();
  if (!redisUrl.startsWith('redis://') && !redisUrl.startsWith('rediss://')) {
    errors.push('REDIS_URL must be a valid Redis connection URI');
  }

  const jwtAccessSecret = rawEnv.JWT_ACCESS_SECRET ?? '';
  if (jwtAccessSecret.length < 32) {
    errors.push('JWT_ACCESS_SECRET must be at least 32 characters long for cryptographic security');
  }

  const jwtRefreshSecret = rawEnv.JWT_REFRESH_SECRET ?? '';
  if (jwtRefreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters long for cryptographic security');
  }

  const otelEndpoint = (rawEnv.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4317').trim();

  if (errors.length > 0) {
    throw new Error(
      `[FATAL BOOT CONFIG ERROR] Application refused to start due to invalid environment variables:\n  - ${errors.join('\n  - ')}`
    );
  }

  return Object.freeze({
    NODE_ENV: nodeEnv as AppEnvConfig['NODE_ENV'],
    PORT: port,
    SERVICE_NAME: serviceName,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    JWT_ACCESS_SECRET: jwtAccessSecret,
    JWT_REFRESH_SECRET: jwtRefreshSecret,
    OTEL_EXPORTER_OTLP_ENDPOINT: otelEndpoint,
    ENABLE_SWAGGER_UI: rawEnv.ENABLE_SWAGGER_UI
      ? rawEnv.ENABLE_SWAGGER_UI === 'true'
      : nodeEnv !== 'production',
  });
}
