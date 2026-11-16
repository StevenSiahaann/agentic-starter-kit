/**
 * Production Structured JSON Logger with OpenTelemetry & AsyncLocalStorage Correlation
 * Implements: Single-line NDJSON format, automatic trace_id & span_id injection, W3C Traceparent
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface TraceContext {
  traceId: string;
  spanId: string;
  userId?: string;
}

// 1. ASYNC LOCAL STORAGE BINDING TRACE CONTEXT PER REQUEST
export const traceStorage = new AsyncLocalStorage<TraceContext>();

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export class StructuredLogger {
  constructor(private readonly serviceName: string) {}

  public info(message: string, context?: Record<string, unknown>, action?: string): void {
    this.writeLog(LogLevel.INFO, message, context, action);
  }

  public warn(message: string, context?: Record<string, unknown>, action?: string): void {
    this.writeLog(LogLevel.WARN, message, context, action);
  }

  public error(message: string, error?: Error | unknown, context?: Record<string, unknown>, action?: string): void {
    const errorDetails = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : { rawError: String(error) };

    this.writeLog(LogLevel.ERROR, message, { ...context, error: errorDetails }, action);
  }

  private writeLog(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    action?: string
  ): void {
    // 2. AUTOMATICALLY EXTRACT TRACE_ID & SPAN_ID FROM ACTIVE ASYNC STORAGE
    const currentTrace = traceStorage.getStore();

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      trace_id: currentTrace?.traceId || '00000000000000000000000000000000',
      span_id: currentTrace?.spanId || '0000000000000000',
      user_id: currentTrace?.userId,
      action: action || 'DEFAULT_ACTION',
      message,
      context: context || {},
    };

    // 3. EMIT SINGLE-LINE JSON (NDJSON) TO STDOUT / STDERR
    const outputString = JSON.stringify(logEntry);

    if (level === LogLevel.ERROR || level === LogLevel.FATAL) {
      process.stderr.write(outputString + '\n');
    } else {
      process.stdout.write(outputString + '\n');
    }
  }
}

export const appLogger = new StructuredLogger(process.env.SERVICE_NAME || 'core-backend-service');
