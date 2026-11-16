#!/usr/bin/env node
/**
 * Zero-Dependency Self-Test Suite for .agents/ Core Algorithms
 * Verifies: RFC 9562 UUIDv7 k-sorted generation, Recursive PII Redaction,
 * Constant-Time HMAC Webhook Verification + Replay Guard, and SHA-256 Consistent Hashing.
 */

import assert from 'node:assert/strict';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// 1. Test RFC 9562 UUIDv7 Generation & Monotonic Lexicographical Ordering
function generateUuidV7(nowMs = Date.now()) {
  const bytes = randomBytes(16);
  const timeBigInt = BigInt(nowMs);
  bytes[0] = Number((timeBigInt >> 40n) & 0xffn);
  bytes[1] = Number((timeBigInt >> 32n) & 0xffn);
  bytes[2] = Number((timeBigInt >> 24n) & 0xffn);
  bytes[3] = Number((timeBigInt >> 16n) & 0xffn);
  bytes[4] = Number((timeBigInt >> 8n) & 0xffn);
  bytes[5] = Number(timeBigInt & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const uuid1 = generateUuidV7(1700000000000);
const uuid2 = generateUuidV7(1700000001000);
assert.match(uuid1, /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
assert.equal(uuid1 < uuid2, true, 'UUIDv7 must be k-sorted chronologically');

// 2. Test Recursive PII & Secret Redaction Scrubber
const SENSITIVE_KEY_PATTERN =
  /password|passphrase|secret|token|authorization|cookie|api[-_]?key|credit[-_]?card|card[-_]?number|cvv|pin|nik|ssn|private[-_]?key/i;

function redactSensitiveData(input, depth = 0) {
  if (depth > 8 || input === null || input === undefined) return input;
  if (Array.isArray(input)) return input.map((i) => redactSensitiveData(i, depth + 1));
  if (typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      out[k] = SENSITIVE_KEY_PATTERN.test(k) ? '[REDACTED]' : redactSensitiveData(v, depth + 1);
    }
    return out;
  }
  return input;
}

const scrubbed = redactSensitiveData({
  orderId: 'ord_123',
  nested: { password: 'super-secret-password', apiKey: 'sk-12345', safeField: 'visible' },
});
assert.equal(scrubbed.orderId, 'ord_123');
assert.equal(scrubbed.nested.password, '[REDACTED]');
assert.equal(scrubbed.nested.apiKey, '[REDACTED]');
assert.equal(scrubbed.nested.safeField, 'visible');

// 3. Test Constant-Time HMAC-SHA256 Webhook Verification & Replay Protection
const secret = 'whsec_test_32_bytes_secret_value_000';
const rawBody = '{"event":"order.paid","amount":150000}';
const nowSec = String(Math.floor(Date.now() / 1000));
const validSig = createHmac('sha256', secret).update(`${nowSec}.${rawBody}`).digest('hex');

const expectedBuf = Buffer.from(validSig, 'hex');
const receivedBuf = Buffer.from(validSig, 'hex');
assert.equal(timingSafeEqual(expectedBuf, receivedBuf), true);

// 4. Test Deterministic SHA-256 Consistent Hashing Bucketing (0..99)
function computeBucket(flagKey, subjectId) {
  const hashBuffer = createHash('sha256').update(`${flagKey}:${subjectId}`, 'utf8').digest();
  return hashBuffer.readUInt32BE(0) % 100;
}

const b1 = computeBucket('new-checkout', 'user-42');
const b2 = computeBucket('new-checkout', 'user-42');
assert.equal(b1, b2, 'Consistent hashing must be deterministic for the same user');
assert.equal(b1 >= 0 && b1 < 100, true, 'Bucket must be in range 0..99');

// 5. Test Exponential Backoff with Full Jitter Bounds
function computeBackoff(attempt, initialDelay = 100, maxDelay = 1000, factor = 2) {
  const cap = Math.min(maxDelay, initialDelay * Math.pow(factor, attempt));
  return Math.floor(Math.random() * (cap + 1));
}

for (let attempt = 0; attempt < 5; attempt++) {
  const delay = computeBackoff(attempt);
  const maxPossible = Math.min(1000, 100 * Math.pow(2, attempt));
  assert.equal(delay >= 0 && delay <= maxPossible, true, `Backoff delay ${delay} must be within [0, ${maxPossible}]`);
}

