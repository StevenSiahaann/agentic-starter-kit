/**
 * Enterprise Performance Benchmark & Concurrency Load Test (k6)
 *
 * Governed by:
 * - .agents/rules/11-computational-complexity-and-metrics.md (SLO: p95 < 200ms, RED metrics)
 * - .agents/rules/03-architecture-and-code.md (Idempotency Key concurrency safety)
 *
 * Execution:
 *   # Via local k6 binary:
 *   k6 run .agents/templates/harness/k6-load-test.js
 *
 *   # Via Docker:
 *   docker run --rm -i --network=host grafana/k6 run - < .agents/templates/harness/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Custom Metrics
const latencyTrend = new Trend('custom_req_duration_ms');
const errorRate = new Rate('custom_error_rate');

// Quality Gate Thresholds (Rule 11 SLOs)
export const options = {
  stages: [
    { duration: '5s', target: 20 },  // Ramp-up to 20 Virtual Users
    { duration: '10s', target: 20 }, // Steady-state load
    { duration: '3s', target: 0 },   // Ramp-down
  ],
  thresholds: {
    // SLO 1: 95th percentile latency must be under 200ms
    http_req_duration: ['p(95)<200'],
    custom_req_duration_ms: ['p(95)<200'],
    // SLO 2: Error rate must be under 0.1% (99.9% success rate)
    http_req_failed: ['rate<0.001'],
    custom_error_rate: ['rate<0.001'],
  },
};

const BASE_URL = __ENV.TARGET_BASE_URL || 'http://127.0.0.1:3000';

function generateUuidV7Like() {
  return '018dc320-' + Math.random().toString(16).substring(2, 6) + '-7' +
    Math.random().toString(16).substring(2, 5) + '-a' +
    Math.random().toString(16).substring(2, 5) + '-' +
    Math.random().toString(16).substring(2, 14);
}

export default function () {
  const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
  const spanId = '00f067aa0ba902b7';
  const traceparent = `00-${traceId}-${spanId}-01`;

  // ==========================================================================
  // SCENARIO 1: Standard API Health & Specification Check
  // ==========================================================================
  const healthRes = http.get(`${BASE_URL}/livez`, {
    headers: {
      traceparent: traceparent,
      Accept: 'application/json',
    },
  });

  const healthOk = check(healthRes, {
    'liveness probe status is 200': (r) => r.status === 200,
    'liveness latency under budget': (r) => r.timings.duration < 100,
  });

  latencyTrend.add(healthRes.timings.duration);
  errorRate.add(!healthOk);

  // ==========================================================================
  // SCENARIO 2: Idempotent Mutation Under Concurrent Load
  // ==========================================================================
  const idempotencyKey = `idemp_k6_${generateUuidV7Like()}`;
  const mutationPayload = JSON.stringify({
    amount: 150000,
    currency: 'IDR',
    description: 'Load test payment transaction',
  });

  const mutationParams = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      traceparent: traceparent,
    },
  };

  // Primary Mutation Attempt
  const mutRes1 = http.post(`${BASE_URL}/api/v1/orders`, mutationPayload, mutationParams);

  // Immediate Concurrent Duplicate Attempt (Simulating network retry or double-click)
  const mutRes2 = http.post(`${BASE_URL}/api/v1/orders`, mutationPayload, mutationParams);

  const mutOk = check(mutRes1, {
    'mutation responds successfully (200 or 201)': (r) => r.status === 200 || r.status === 201,
  });

  // Verify Idempotency Replay
  const idempOk = check(mutRes2, {
    'duplicate mutation returns identical status without error': (r) =>
      r.status === mutRes1.status,
  });

  latencyTrend.add(mutRes1.timings.duration);
  errorRate.add(!mutOk || !idempOk);

  sleep(0.5);
}

