/**
 * Kubernetes / Container Graceful Shutdown & Healthcheck Probes Template
 * Implements: /livez (Liveness), /readyz (Readiness with dependency checks),
 * SIGTERM/SIGINT signal trapping, Readiness drain flip (503), and deadline timeout guard.
 */

import { appLogger, StructuredLogger } from './otel-logger';

export interface ClosableResource {
  name: string;
  close: () => Promise<void>;
  checkHealth?: () => Promise<boolean>;
}

export interface HealthProbeStatus {
  status: 'OK' | 'DEGRADED' | 'DRAINING';
  httpStatusCode: 200 | 503;
  checks: Record<string, 'UP' | 'DOWN'>;
  timestamp: string;
}

export class LifecycleManager {
  private isShuttingDown = false;
  private readonly resources: ClosableResource[] = [];

  constructor(
    private readonly shutdownTimeoutMs = 15_000,
    private readonly logger: StructuredLogger = appLogger
  ) {}

  public registerResource(resource: ClosableResource): this {
    this.resources.push(resource);
    return this;
  }

  /**
   * Liveness Probe (/livez): Confirms the Node.js event loop is responsive.
   */
  public getLiveness(): { status: 'OK'; httpStatusCode: 200 } {
    return { status: 'OK', httpStatusCode: 200 };
  }

  /**
   * Readiness Probe (/readyz): Returns 503 immediately once SIGTERM arrives so Kubernetes
   * removes the pod from Service endpoints before closing active connections.
   */
  public async getReadiness(): Promise<HealthProbeStatus> {
    if (this.isShuttingDown) {
      return {
        status: 'DRAINING',
        httpStatusCode: 503,
        checks: {},
        timestamp: new Date().toISOString(),
      };
    }

    const checks: Record<string, 'UP' | 'DOWN'> = {};
    let allHealthy = true;

    for (const resource of this.resources) {
      if (resource.checkHealth) {
        try {
          const ok = await resource.checkHealth();
          checks[resource.name] = ok ? 'UP' : 'DOWN';
          if (!ok) allHealthy = false;
        } catch {
          checks[resource.name] = 'DOWN';
          allHealthy = false;
        }
      }
    }

    return {
      status: allHealthy ? 'OK' : 'DEGRADED',
      httpStatusCode: allHealthy ? 200 : 503,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Attaches OS signal listeners (SIGTERM, SIGINT) to orchestrate zero-downtime shutdown.
   */
  public bindProcessSignals(): void {
    const handleSignal = (signal: NodeJS.Signals) => {
      void this.shutdown(signal);
    };

    process.once('SIGTERM', handleSignal);
    process.once('SIGINT', handleSignal);
  }

  public async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info(
      'Termination signal received; flipping readiness probe to 503 and draining resources',
      { signal, timeoutMs: this.shutdownTimeoutMs },
      'SHUTDOWN_START'
    );

    const forceExitTimer = setTimeout(() => {
      this.logger.error(
        'Graceful shutdown exceeded deadline; forcing process exit',
        new Error('ShutdownDeadlineExceeded'),
        { timeoutMs: this.shutdownTimeoutMs },
        'SHUTDOWN_TIMEOUT'
      );
      process.exit(1);
    }, this.shutdownTimeoutMs);

    try {
      // Close resources in LIFO order (HTTP server first -> Workers -> Redis -> DB Pool last)
      for (const resource of [...this.resources].reverse()) {
        this.logger.info('Closing resource', { resourceName: resource.name }, 'SHUTDOWN_RESOURCE');
        await resource.close();
      }

      clearTimeout(forceExitTimer);
      this.logger.info('All resources closed cleanly; exiting process', {}, 'SHUTDOWN_COMPLETE');
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      this.logger.error('Error occurred during graceful shutdown', error, {}, 'SHUTDOWN_ERROR');
      process.exit(1);
    }
  }
}

