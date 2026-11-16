/**
 * Distributed Transactions Saga Orchestrator Template
 * Implements: Forward execution steps, automatic LIFO compensating rollback on failure,
 * Structured OTel Logging, and Dead Letter Queue (DLQ) fallback handler.
 */

import { appLogger, StructuredLogger } from './otel-logger';

export interface SagaStep<TContext> {
  name: string;
  execute: (context: TContext) => Promise<void>;
  compensate: (context: TContext) => Promise<void>;
}

export interface SagaDeadLetterHandler<TContext> {
  onCompensationFailed(stepName: string, context: TContext, error: unknown): Promise<void>;
}

export class SagaCoordinator<TContext> {
  private steps: SagaStep<TContext>[] = [];
  private executedSteps: SagaStep<TContext>[] = [];

  constructor(
    private readonly logger: StructuredLogger = appLogger,
    private readonly dlqHandler?: SagaDeadLetterHandler<TContext>
  ) {}

  public addStep(step: SagaStep<TContext>): this {
    this.steps.push(step);
    return this;
  }

  public async execute(context: TContext): Promise<{ success: boolean; error?: Error }> {
    this.executedSteps = [];

    for (const step of this.steps) {
      try {
        this.logger.info('Executing saga forward step', { stepName: step.name }, 'SAGA_EXECUTE');
        await step.execute(context);
        this.executedSteps.push(step);
      } catch (forwardError) {
        this.logger.error(
          'Saga forward step failed; initiating LIFO compensating rollback',
          forwardError,
          { failedStep: step.name },
          'SAGA_ROLLBACK_START'
        );
        await this.rollback(context);
        return {
          success: false,
          error: forwardError instanceof Error ? forwardError : new Error(String(forwardError)),
        };
      }
    }

    this.logger.info(
      'All saga forward steps completed successfully',
      { totalSteps: this.steps.length },
      'SAGA_COMPLETE'
    );
    return { success: true };
  }

  private async rollback(context: TContext): Promise<void> {
    // Execute compensating transactions in reverse order (LIFO - Last In, First Out)
    const stepsToRollback = [...this.executedSteps].reverse();

    for (const step of stepsToRollback) {
      try {
        this.logger.info(
          'Executing saga compensating rollback step',
          { stepName: step.name },
          'SAGA_COMPENSATE'
        );
        await step.compensate(context);
      } catch (compensationError) {
        // Log critical alert and route unrecoverable compensation failure to DLQ for manual intervention
        this.logger.error(
          'CRITICAL: Saga compensating transaction failed; routing to DLQ',
          compensationError,
          { stepName: step.name },
          'SAGA_COMPENSATION_FAILED'
        );
        if (this.dlqHandler) {
          await this.dlqHandler.onCompensationFailed(step.name, context, compensationError);
        }
      }
    }
  }
}
