/**
 * Clean Architecture Use-Case & Command Handler Template
 * Implements: Single Responsibility Principle, Result<T, E> Pattern, Domain vs. System Errors,
 * Native RFC 9562 UUIDv7 Generator, and Transactional Outbox Pattern.
 */

import { randomBytes } from 'crypto';
import { appLogger } from './otel-logger';

// 0. NATIVE RFC 9562 UUIDv7 GENERATOR (Time-ordered k-sorted, Zero External Dependencies)
export function generateUuidV7(nowMs = Date.now()): string {
  const bytes = randomBytes(16);
  const timeBigInt = BigInt(nowMs);

  // 48-bit big-endian Unix timestamp in milliseconds
  bytes[0] = Number((timeBigInt >> 40n) & 0xffn);
  bytes[1] = Number((timeBigInt >> 32n) & 0xffn);
  bytes[2] = Number((timeBigInt >> 24n) & 0xffn);
  bytes[3] = Number((timeBigInt >> 16n) & 0xffn);
  bytes[4] = Number((timeBigInt >> 8n) & 0xffn);
  bytes[5] = Number(timeBigInt & 0xffn);

  // Version 7 (0111) in the high nibble of byte 6
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // Variant RFC 9562 (10xx) in the high bits of byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// 1. DOMAIN RESULT PATTERN (Functional Either)
export class Result<TSuccess, TError> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly value?: TSuccess,
    public readonly error?: TError
  ) {}

  public static ok<U>(value: U): Result<U, never> {
    return new Result<U, never>(true, value, undefined);
  }

  public static fail<E>(error: E): Result<never, E> {
    return new Result<never, E>(false, undefined, error);
  }
}

// 2. TYPED DOMAIN ERRORS (Business Invariants)
export abstract class DomainError extends Error {
  public abstract readonly code: string;
  public abstract readonly statusCode: number;
}

export class InvalidOrderAmountError extends DomainError {
  public readonly code = 'INVALID_ORDER_AMOUNT';
  public readonly statusCode = 422;

  constructor(public readonly amount: number) {
    super(`Invalid order total amount (${amount}). Total amount must be strictly greater than 0.`);
  }
}

export class OrderAlreadyCancelledError extends DomainError {
  public readonly code = 'ORDER_ALREADY_CANCELLED';
  public readonly statusCode = 409;

  constructor(public readonly orderId: string) {
    super(`Order ${orderId} has already been cancelled.`);
  }
}

export class InsufficientFundsError extends DomainError {
  public readonly code = 'INSUFFICIENT_FUNDS';
  public readonly statusCode = 409;

  constructor(public readonly required: number, public readonly available: number) {
    super(`Insufficient account balance. Required: ${required}, Available: ${available}.`);
  }
}

// 3. COMMAND DTO & PERSISTENCE MODELS
export interface CreateOrderCommand {
  readonly userId: string;
  readonly items: ReadonlyArray<{
    readonly productId: string;
    readonly quantity: number;
    readonly unitPrice: number;
  }>;
  readonly idempotencyKey: string;
}

export interface OrderRecord {
  readonly id: string;
  readonly userId: string;
  readonly totalAmount: number;
  readonly status: 'PAID' | 'CANCELLED';
  readonly version: number;
}

export interface OutboxEventRecord {
  readonly id: string;
  readonly aggregateType: 'ORDER';
  readonly aggregateId: string;
  readonly eventType: 'ORDER_CREATED';
  readonly payload: Record<string, unknown>;
}

// 4. REPOSITORY & GATEWAY PORTS (Outward Contract Interfaces)
export interface OrderRepositoryPort {
  saveWithOutbox(order: OrderRecord, outboxEvent: OutboxEventRecord): Promise<void>;
  findById(orderId: string): Promise<OrderRecord | null>;
}

export interface PaymentGatewayPort {
  charge(amount: number, currency: string, idempotencyKey: string): Promise<Result<string, DomainError>>;
}

// 5. USE-CASE / COMMAND HANDLER (Single Responsibility)
export class CreateOrderHandler {
  constructor(
    private readonly orderRepository: OrderRepositoryPort,
    private readonly paymentGateway: PaymentGatewayPort
  ) {}

  public async execute(
    command: CreateOrderCommand
  ): Promise<Result<{ orderId: string; transactionId: string }, DomainError>> {
    // a. Single-Pass O(N) Calculation & Invariant Validation
    let totalAmount = 0;
    for (const item of command.items) {
      totalAmount += item.quantity * item.unitPrice;
    }

    if (totalAmount <= 0 || command.items.length === 0) {
      appLogger.warn('Order creation rejected due to invalid total amount', { totalAmount }, 'CREATE_ORDER');
      return Result.fail(new InvalidOrderAmountError(totalAmount));
    }

    // b. Execute Payment via Outward Port with Idempotency Key
    const paymentResult = await this.paymentGateway.charge(
      totalAmount,
      'IDR',
      command.idempotencyKey
    );

    if (!paymentResult.isSuccess || !paymentResult.value) {
      appLogger.warn(
        'Order payment rejected with domain error',
        { code: paymentResult.error?.code },
        'CREATE_ORDER'
      );
      return Result.fail(paymentResult.error!);
    }

    const orderId = generateUuidV7();
    const transactionId = paymentResult.value;

    // c. Persist Order + Outbox Event Atomically (Transactional Outbox Pattern)
    await this.orderRepository.saveWithOutbox(
      {
        id: orderId,
        userId: command.userId,
        totalAmount,
        status: 'PAID',
        version: 1,
      },
      {
        id: generateUuidV7(),
        aggregateType: 'ORDER',
        aggregateId: orderId,
        eventType: 'ORDER_CREATED',
        payload: {
          orderId,
          userId: command.userId,
          totalAmount,
          transactionId,
        },
      }
    );

    appLogger.info(
      'Order created and transactional outbox event persisted atomically',
      { orderId, transactionId, totalAmount },
      'CREATE_ORDER'
    );

    return Result.ok({
      orderId,
      transactionId,
    });
  }
}
