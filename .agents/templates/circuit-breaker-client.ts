/**
 * Resilient HTTP/gRPC Client with Circuit Breaker & Exponential Backoff + Full Jitter
 * Implements: CLOSED, OPEN, HALF_OPEN states, Rolling Window Metrics, Half-Open Probe Gate, Fail-Fast
 */

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal: Requests pass through with sliding window failure tracking
  OPEN = 'OPEN',           // Tripped: Requests fail fast immediately to protect downstream service
  HALF_OPEN = 'HALF_OPEN', // Recovery Probe: Admits a capped number of test requests to verify recovery
}

export interface CircuitBreakerOptions {
  failureThresholdPercentage: number; // Failure percentage that trips the circuit (e.g., 50)
  minimumRequests: number;            // Minimum requests in window before evaluating threshold (e.g., 10)
  windowDurationMs?: number;          // Rolling metric window duration in CLOSED state (default: 60,000 ms)
  resetTimeoutMs: number;             // Duration in OPEN before transitioning to HALF_OPEN (e.g., 30,000 ms)
  halfOpenMaxProbes?: number;         // Consecutive successful probes in HALF_OPEN required to close (default: 2)
  requestTimeoutMs: number;           // Per-attempt timeout in milliseconds (e.g., 3,000 ms)
  maxRetries: number;                 // Maximum retry attempts per execution (e.g., 3)
}

export class CircuitBreakerOpenError extends Error {
  public readonly code = 'CIRCUIT_BREAKER_OPEN';
  constructor(message = '[CircuitBreaker] Circuit is OPEN. Failing fast to protect downstream service.') {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreakerClient {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private requestCount = 0;
  private halfOpenSuccessCount = 0;
  private halfOpenInFlight = 0;
  private windowStartTimestamp = Date.now();
  private nextAttemptTimestamp = 0;

  private readonly windowDurationMs: number;
  private readonly halfOpenMaxProbes: number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.windowDurationMs = options.windowDurationMs ?? 60_000;
    this.halfOpenMaxProbes = options.halfOpenMaxProbes ?? 2;
  }

  public getState(): CircuitState {
    return this.state;
  }

  public async execute<T>(requestFn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // 1. Evaluate transition from OPEN -> HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (now >= this.nextAttemptTimestamp) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenSuccessCount = 0;
        this.halfOpenInFlight = 0;
      } else {
        throw new CircuitBreakerOpenError();
      }
    }

    // 2. Cap concurrent probe requests in HALF_OPEN state (prevents Thundering Herd on recovery)
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenInFlight >= this.halfOpenMaxProbes) {
        throw new CircuitBreakerOpenError(
          '[CircuitBreaker] Circuit is HALF_OPEN and probe capacity is saturated. Failing fast.'
        );
      }
      this.halfOpenInFlight++;
    }

    try {
      // 3. Execute request with Exponential Backoff + Full Jitter
      const result = await this.executeWithRetry(requestFn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    } finally {
      if (this.state === CircuitState.HALF_OPEN && this.halfOpenInFlight > 0) {
        this.halfOpenInFlight--;
      }
    }
  }

  private async executeWithRetry<T>(requestFn: () => Promise<T>): Promise<T> {
    let attempt = 0;

    while (attempt <= this.options.maxRetries) {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          requestFn(),
          new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error('Request Timeout')),
              this.options.requestTimeoutMs
            );
          }),
        ]);
      } catch (error) {
        attempt++;
        if (attempt > this.options.maxRetries) {
          throw error;
        }

        // Exponential Backoff with Full Jitter: sleep = random(0, min(maxBackoff, base * 2^attempt))
        const maxBackoffMs = 5_000;
        const cap = Math.min(maxBackoffMs, 100 * Math.pow(2, attempt));
        const jitterMs = Math.floor(Math.random() * cap);
        await new Promise((resolve) => setTimeout(resolve, jitterMs));
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }
    }

    throw new Error('Maximum retries exceeded');
  }

  private ensureRollingWindow(): void {
    const now = Date.now();
    if (now - this.windowStartTimestamp >= this.windowDurationMs) {
      this.resetMetrics(now);
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccessCount++;
      if (this.halfOpenSuccessCount >= this.halfOpenMaxProbes) {
        this.state = CircuitState.CLOSED;
        this.resetMetrics(Date.now());
      }
      return;
    }

    // CLOSED state: ensure active rolling window and increment total request count
    this.ensureRollingWindow();
    this.requestCount++;
  }

  private onFailure(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.tripCircuit();
      return;
    }

    this.ensureRollingWindow();
    this.failureCount++;
    this.requestCount++;

    if (this.requestCount >= this.options.minimumRequests) {
      const failureRate = (this.failureCount / this.requestCount) * 100;
      if (failureRate >= this.options.failureThresholdPercentage) {
        this.tripCircuit();
      }
    }
  }

  private tripCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTimestamp = Date.now() + this.options.resetTimeoutMs;
    this.halfOpenSuccessCount = 0;
    this.halfOpenInFlight = 0;
  }

  private resetMetrics(now = Date.now()): void {
    this.failureCount = 0;
    this.requestCount = 0;
    this.windowStartTimestamp = now;
  }
}
