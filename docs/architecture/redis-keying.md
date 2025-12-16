# Redis Keying Patterns & TTL Guidance

This document defines recommended Redis key naming conventions for a multi-tenant Unified Commerce OS deployment.

## Goals

- Avoid key collisions across tenants
- Keep keys discoverable and easy to invalidate
- Make TTL choices explicit (short-lived vs cached vs durable)

## Key Prefixing

Always prefix with a tenant scope unless the data is truly global:

- Tenant-scoped: `t:{tenantId}:...`
- Global/system-scoped: `sys:...`

Use colon-delimited segments and keep key depth consistent.

## Recommended Patterns

### Tenant config cache

- Key: `t:{tenantId}:config`
- Type: `hash`
- TTL: 5–15 minutes
- Notes: Invalidate on configuration writes; keep TTL as a safety net.

### Session storage

- Key: `t:{tenantId}:session:{sessionId}`
- Type: `string` (opaque JSON) or `hash`
- TTL: match session lifetime (e.g. 7–30 days)

### OAuth/JWT JTI revocation / allowlist

- Key: `t:{tenantId}:auth:jti:{jti}`
- Type: `string` (value can be `1`)
- TTL: token expiry + small buffer (e.g. +5 minutes)

### Idempotency keys (webhooks, payments)

- Key: `t:{tenantId}:idemp:{scope}:{key}`
  - Example: `t:...:idemp:payments:stripe_evt_123`
- Type: `string`
- TTL: 24–72 hours

### Inventory reservations (short-term holds)

- Key: `t:{tenantId}:inv:reserve:{reservationId}`
- Type: `hash`
- TTL: 5–30 minutes
- Notes: Use a short TTL to prevent indefinite holds. Store `{productId, locationId, qty, expiresAt}`.

### Rate limiting

- Key: `t:{tenantId}:rl:{route}:{identity}:{window}`
  - Example: `t:...:rl:/api/orders:user_123:2025-01-16T10:00Z`
- Type: `string` (counter)
- TTL: duration of the window (e.g. 60 seconds)

## TTL Guidance

- Prefer TTL for anything derived, cached, or ephemeral.
- Avoid TTL for data that must be durable; that belongs in Postgres/Kafka.
- Use explicit TTL per key class (sessions vs idempotency vs caching) rather than a single global default.

## Invalidation Strategies

- Write-through cache for configuration (invalidate on update)
- Event-driven invalidation using NATS/Kafka (e.g. `inventory.updated` invalidates inventory snapshot caches)
- Tenant-wide invalidation by scanning `t:{tenantId}:*` should be reserved for emergency operations due to cost.
