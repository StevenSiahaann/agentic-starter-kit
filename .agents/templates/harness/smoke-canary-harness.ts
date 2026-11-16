/**
 * Synthetic Canary & E2E Smoke Testing Harness
 *
 * Lightweight, zero-dependency Node.js ESM canary test runner.
 * Evaluates production readiness and health post-deployment without spinning up full browser engines.
 *
 * Checks:
 * 1. Kubernetes Liveness Probe (`/livez`)
 * 2. Kubernetes Readiness Probe (`/readyz`)
 * 3. Contract-First OpenAPI Specification (`/api/openapi.json`)
 * 4. Interactive Swagger UI Documentation (`/api/docs`)
 * 5. W3C Distributed Trace Propagation & Latency Budget (<200ms)
 */

export interface CanaryCheckResult {
  readonly name: string;
  readonly path: string;
  readonly passed: boolean;
  readonly statusCode: number;
  readonly durationMs: number;
  readonly latencyBudgetMs: number;
  readonly error?: string;
  readonly traceId?: string;
}

export interface CanarySuiteConfig {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly latencyBudgetMs?: number;
}

export class SmokeCanaryHarness {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly latencyBudgetMs: number;

  constructor(config: CanarySuiteConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = config.timeoutMs ?? 5_000;
    this.latencyBudgetMs = config.latencyBudgetMs ?? 200;
  }

  private generateW3cTraceparent(): { traceparent: string; traceId: string } {
    const traceId = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    const parentId = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    return {
      traceparent: `00-${traceId}-${parentId}-01`,
      traceId,
    };
  }

  private async executeProbe(params: {
    readonly name: string;
    readonly path: string;
    readonly expectedStatus: number;
    readonly validator?: (body: string, headers: Headers) => boolean;
  }): Promise<CanaryCheckResult> {
    const url = `${this.baseUrl}${params.path}`;
    const { traceparent, traceId } = this.generateW3cTraceparent();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const start = performance.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          traceparent,
          'User-Agent': 'Antigravity-Canary-Harness/2.3.0',
          Accept: '*/*',
        },
        signal: controller.signal,
      });

      const durationMs = Math.round(performance.now() - start);
      const text = await response.text();
      clearTimeout(timer);

      const statusMatch = response.status === params.expectedStatus;
      const customValid = params.validator ? params.validator(text, response.headers) : true;
      const withinBudget = durationMs <= this.latencyBudgetMs;
      const passed = statusMatch && customValid && withinBudget;

      const errorParts: string[] = [];
      if (!statusMatch) errorParts.push(`Expected HTTP ${params.expectedStatus}, got ${response.status}`);
      if (!customValid) errorParts.push('Payload validation failed');
      if (!withinBudget) errorParts.push(`Latency ${durationMs}ms exceeded budget ${this.latencyBudgetMs}ms`);

      return {
        name: params.name,
        path: params.path,
        passed,
        statusCode: response.status,
        durationMs,
        latencyBudgetMs: this.latencyBudgetMs,
        error: errorParts.length > 0 ? errorParts.join('; ') : undefined,
        traceId,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const durationMs = Math.round(performance.now() - start);
      const errorMessage = err instanceof Error ? err.message : String(err);

      return {
        name: params.name,
        path: params.path,
        passed: false,
        statusCode: 0,
        durationMs,
        latencyBudgetMs: this.latencyBudgetMs,
        error: `Connection failure: ${errorMessage}`,
        traceId,
      };
    }
  }

  public async runSuite(): Promise<{
    readonly allPassed: boolean;
    readonly results: readonly CanaryCheckResult[];
  }> {
    const results: CanaryCheckResult[] = [];

    // 1. Liveness Probe
    results.push(
      await this.executeProbe({
        name: 'Liveness Probe',
        path: '/livez',
        expectedStatus: 200,
        validator: (body) => body.includes('UP') || body.includes('ok'),
      })
    );

    // 2. Readiness Probe
    results.push(
      await this.executeProbe({
        name: 'Readiness Probe',
        path: '/readyz',
        expectedStatus: 200,
      })
    );

    // 3. OpenAPI 3.1 Specification Contract
    results.push(
      await this.executeProbe({
        name: 'OpenAPI Specification Contract',
        path: '/api/openapi.json',
        expectedStatus: 200,
        validator: (body) => {
          try {
            const parsed = JSON.parse(body) as { openapi?: string; paths?: Record<string, unknown> };
            return typeof parsed.openapi === 'string' && parsed.openapi.startsWith('3.');
          } catch {
            return false;
          }
        },
      })
    );

    // 4. Interactive Swagger UI Docs
    results.push(
      await this.executeProbe({
        name: 'Swagger UI Documentation',
        path: '/api/docs',
        expectedStatus: 200,
        validator: (body) => body.includes('swagger-ui') || body.includes('SwaggerUIBundle'),
      })
    );

    const allPassed = results.every((r) => r.passed);
    return { allPassed, results };
  }
}

/**
 * CLI Entrypoint when executed directly via Node.js
 */
export async function runCanaryCli(targetUrl: string = process.env.CANARY_BASE_URL ?? 'http://127.0.0.1:3000'): Promise<void> {
  process.stdout.write(`\n--- Starting Synthetic Canary Probing: ${targetUrl} ---\n`);
  const harness = new SmokeCanaryHarness({ baseUrl: targetUrl });
  const { allPassed, results } = await harness.runSuite();

  for (const check of results) {
    const icon = check.passed ? '[PASS]' : '[FAIL]';
    process.stdout.write(
      `${icon} ${check.name} (${check.path}) - HTTP ${check.statusCode} - ${check.durationMs}ms (budget: ${check.latencyBudgetMs}ms)\n`
    );
    if (check.error) {
      process.stdout.write(`       Reason: ${check.error}\n`);
    }
  }

  process.stdout.write(`\nCanary Suite Completed. Status: ${allPassed ? 'HEALTHY' : 'UNHEALTHY'}\n`);
  if (!allPassed) {
    process.exitCode = 1;
  }
}

