---
trigger: model_decision
description: Webhook security (HMAC-SHA256 timingSafeEqual signature verification, timestamp replay protection), Transactional Inbox pattern (inbox_events deduplication), and CloudEvents 1.0 schema evolution. Activate when building or integrating webhooks, payment callbacks, or event consumers.
---

# Webhook Security, Transactional Inbox, & Event Contract Standards

> **Status:** MANDATORY INTEGRATION & EVENT STANDARD  
> **Target:** All Inbound/Outbound Webhooks, Payment Callbacks, and Asynchronous Event Consumers.

---

## 1. Cryptographic Webhook Verification

Treat every inbound webhook endpoint as a public, untrusted attack surface.

### A. Constant-Time HMAC Signature Verification (`crypto.timingSafeEqual`)
1. **Verify Against Raw Body Bytes**: Compute the HMAC-SHA256 digest over the exact unparsed **raw HTTP request buffer (`rawBody`)**, never over `JSON.stringify(req.body)` (key ordering or whitespace differences in re-serialized JSON invalidate signatures).
2. **Constant-Time Comparison**: Compare the computed HMAC digest against the provider's signature header using **`crypto.timingSafeEqual(expectedBuffer, receivedBuffer)`**. Never use `===` string comparison, which leaks byte-by-byte timing side-channels.

### B. Replay Attack Protection (5-Minute Timestamp Tolerance)
- Require a signed timestamp header (e.g., `X-Webhook-Timestamp`).
- Reject any webhook where the absolute difference between server UTC time and the signed timestamp exceeds **300 seconds (5 minutes)**:
  $$|t_{\text{server}} - t_{\text{webhook}}| > 300\text{s} \implies \text{HTTP } 401 \text{ Reject}$$
- Ensure the HMAC signing payload concatenates `${timestamp}.${rawBody}` so an attacker cannot modify the timestamp without invalidating the signature.

---

## 2. Transactional Inbox Pattern (Idempotent Webhook & Event Consumption)

External webhook providers (Stripe, Midtrans, Xendit, GitHub) and message brokers guarantee *At-Least-Once Delivery*, meaning the exact same event WILL be delivered multiple times.

### A. Acknowledge Fast ($< 200\text{ms}$), Process Safely
1. Verify the HMAC signature and timestamp window.
2. Insert the incoming event into the `inbox_events` table using `ON CONFLICT (provider, provider_event_id) DO NOTHING`:
   ```sql
   CREATE TABLE inbox_events (
       id UUID PRIMARY KEY, -- RFC 9562 UUIDv7
       provider VARCHAR(64) NOT NULL,
       provider_event_id VARCHAR(128) NOT NULL,
       event_type VARCHAR(128) NOT NULL,
       payload JSONB NOT NULL,
       status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSED', 'DEAD_LETTER')),
       processed_at TIMESTAMPTZ NULL,
       created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       UNIQUE (provider, provider_event_id)
   );

   CREATE INDEX idx_inbox_pending ON inbox_events(created_at ASC) WHERE status = 'PENDING';
   ```
3. If the `INSERT` reports `rowCount === 0` (duplicate delivery), immediately return `200 OK` (`Idempotent-Duplicate: true`) without re-running business logic.
4. For long-running workflows, commit the `PENDING` inbox row and return `202 Accepted` immediately so the provider never times out, then process asynchronously via a worker using `FOR UPDATE SKIP LOCKED`.

---

## 3. Outbound Event & Webhook Contract Evolution (CloudEvents 1.0)

Format all published domain events and outbound webhooks using the standard **CloudEvents 1.0** envelope:
```json
{
  "specversion": "1.0",
  "id": "018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e99",
  "source": "urn:service:orders",
  "type": "com.domain.order.created.v1",
  "time": "2026-11-16T14:30:00.000Z",
  "datacontenttype": "application/json",
  "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
  "data": {
    "order_id": "018dc320-1a2b-7c3d-9e4f-5a6b7c8d9e0f",
    "total_amount_minor": 15000000,
    "currency": "IDR"
  }
}
```
* **Schema Evolution Rule**: Never remove or change the type of existing fields inside `v1` events. Introduce incompatible payload changes under a new versioned event type (`com.domain.order.created.v2`).

