/**
 * @file integration-harness.ts
 * @description Production Integration Test Harness using Docker Testcontainers.
 * Spawns real, isolated PostgreSQL and Redis instances for integration testing.
 */

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { Pool } from 'pg';
import { execSync } from 'child_process';
import { appLogger } from '../otel-logger';

export interface HarnessConfig {
  postgresImage?: string;
  redisImage?: string;
  runMigrations?: boolean;
}

export class IntegrationTestHarness {
  private pgContainer!: StartedPostgreSqlContainer;
  private redisContainer!: StartedRedisContainer;
  public dbPool!: Pool;
  public databaseUrl!: string;
  public redisUrl!: string;

  constructor(private readonly config: HarnessConfig = {}) {
    this.config.postgresImage = config.postgresImage ?? 'postgres:16-alpine';
    this.config.redisImage = config.redisImage ?? 'redis:7-alpine';
    this.config.runMigrations = config.runMigrations ?? true;
  }

  /**
   * Bootstraps ephemeral Docker containers and connects clients.
   * Call inside jest/vitest beforeAll() block with generous timeout (e.g. 60000ms).
   */
  async start(): Promise<void> {
    // 1. Boot Postgres Container
    this.pgContainer = await new PostgreSqlContainer(this.config.postgresImage!)
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_secret')
      .start();

    this.databaseUrl = this.pgContainer.getConnectionUri();

    // 2. Boot Redis Container
    this.redisContainer = await new RedisContainer(this.config.redisImage!).start();
    this.redisUrl = this.redisContainer.getConnectionUrl();

    // Inject into environment variables for application code
    process.env.DATABASE_URL = this.databaseUrl;
    process.env.REDIS_URL = this.redisUrl;

    // 3. Run Migrations automatically if enabled
    if (this.config.runMigrations) {
      try {
        execSync('npx prisma migrate deploy || npx knex migrate:latest || true', {
          env: process.env,
          stdio: 'pipe',
        });
      } catch (err) {
        appLogger.warn('Auto-migration command exited with notice', { error: String(err) }, 'HARNESS_MIGRATE');
      }
    }

    // 4. Initialize Database Connection Pool
    this.dbPool = new Pool({
      connectionString: this.databaseUrl,
      max: 10,
    });
  }

  /**
   * Resets all table data between individual test cases to preserve isolation.
   * Call inside beforeEach() block.
   */
  async resetDatabase(): Promise<void> {
    const client = await this.dbPool.connect();
    try {
      // Truncate all non-system tables
      await client.query(`
        DO $$ DECLARE
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename NOT LIKE '_prisma%') LOOP
                EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE;';
            END LOOP;
        END $$;
      `);
    } finally {
      client.release();
    }
  }

  /**
   * Tears down ephemeral Docker containers and releases pool connections.
   * Call inside afterAll() block.
   */
  async stop(): Promise<void> {
    if (this.dbPool) {
      await this.dbPool.end();
    }
    if (this.pgContainer) {
      await this.pgContainer.stop();
    }
    if (this.redisContainer) {
      await this.redisContainer.stop();
    }
  }
}
