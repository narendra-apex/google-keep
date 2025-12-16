# OpenAPI Specifications - Unified Commerce OS

This directory contains the complete OpenAPI 3.1.0 specifications for the Unified Commerce OS platform, covering all Phase 1-3 modules.

## Files

### 1. `foundation.yaml`

**Coverage**: Phase 1-2 foundation modules

**Modules**:
- **Identity & RBAC** - User management, authentication, role-based access control
- **Product Information Management (PIM)** - Products, variants, categories, metadata
- **Procurement** - Purchase orders, supplier management, PO lifecycle

**Endpoints**: 30+

**Key Features**:
- JWT Bearer token authentication
- Tenant isolation via `x-tenant-id` header + RLS
- RBAC scopes (role-based permissions)
- Pagination support (limit/offset)
- Webhook registration for events

**Event Mappings**:
- `POST /auth/token` → Authentication flow
- `POST /users` → `user.created` event
- `POST /products` → `product.created` event
- `PATCH /products/{id}` → `product.updated` event
- `DELETE /products/{id}` → `product.deleted` event
- `POST /products/{id}/variants` → `product_variant.created` event
- `POST /categories` → `category.created` event
- `POST /procurement/orders` → `po.created` event
- `POST /procurement/orders/{id}/acknowledge` → `po.acknowledged` event
- `POST /webhooks` → `webhook.registered` event

### 2. `commerce.yaml`

**Coverage**: Phase 1-3 commerce and operations modules

**Modules**:
- **Inventory Management** - Stock levels, allocations, adjustments, low-stock alerts
- **Order Management System (OMS)** - Order creation, fulfillment, shipments, returns
- **Finance** - Invoicing, payments, credit memos, accounting integration

**Endpoints**: 25+

**Key Features**:
- Same authentication model as foundation.yaml
- Pagination for all list endpoints
- Error handling with request correlation IDs
- Finance-specific audit trails

**Event Mappings**:
- `POST /inventory/adjustments` → `inventory.adjusted` event
- `GET /inventory/stock` → No event (read-only)
- `POST /orders` → `order.created` event (cascades to inventory allocation & fraud detection)
- `POST /orders/{id}/confirm` → `order.confirmed` event
- `POST /orders/{id}/cancel` → `order.cancelled` event (triggers refunds & stock release)
- `POST /shipments` → `shipment.created` event
- `POST /invoices` → `invoice.created` event
- `POST /payments` → `payment.received` event

### 3. `ecommerce.yaml`

**Coverage**: Storefront and e-commerce channel operations

**Modules**:
- **E-Commerce Channels** - Multi-channel sales (storefront, marketplace, mobile, social)
- **Customer Management** - Registration, profiles, preferences
- **Shopping Cart & Checkout** - Cart operations, promo codes, order conversion
- **Reviews & Ratings** - Product reviews, helpful voting

**Endpoints**: 20+

**Key Features**:
- Dual authentication: Session (storefront) + JWT (admin)
- Brand context via `x-brand-id` header
- Public endpoints for browsing, authenticated for orders
- Promo code validation and application
- Customer loyalty tracking

**Event Mappings**:
- `POST /customers` → Customer registration (implicit event)
- `POST /cart/checkout` → Order creation (delegates to commerce API)
- `POST /products/{id}/reviews` → Review submission
- `POST /admin/promo-codes` → Promo code creation

---

## Event-to-Endpoint Mapping

### Complete Coverage by Module

| Module | Total Events | Implemented Endpoints | Coverage |
|--------|--------------|----------------------|----------|
| Identity/RBAC | 2 | 5 | 100% |
| PIM | 5 | 12 | 100% |
| Procurement | 5 | 6 | 100% |
| Inventory | 4 | 4 | 100% |
| OMS/Fulfillment | 8 | 8 | 100% |
| Finance | 5 | 6 | 100% |
| E-Commerce Channels | 2 | 7 | 100% |
| **TOTAL** | **31+** | **48+** | **100%** |

### Event Catalog References

Every endpoint includes documentation of related events from `/docs/domain/event-catalog.md`:

1. **`user.created`** - Triggered by `POST /users` (Identity module)
2. **`product.created`** - Triggered by `POST /products` (PIM module)
3. **`product.updated`** - Triggered by `PATCH /products/{id}` (PIM module)
4. **`product.deleted`** - Triggered by `DELETE /products/{id}` (PIM module)
5. **`product_variant.created`** - Triggered by `POST /products/{id}/variants` (PIM module)
6. **`category.created`** - Triggered by `POST /categories` (PIM module)
7. **`po.created`** - Triggered by `POST /procurement/orders` (Procurement module)
8. **`po.acknowledged`** - Triggered by `POST /procurement/orders/{id}/acknowledge` (Procurement module)
9. **`inventory.adjusted`** - Triggered by `POST /inventory/adjustments` (Inventory module)
10. **`inventory.stock_allocated`** - Triggered by `POST /orders` (Order creation auto-allocates)
11. **`order.created`** - Triggered by `POST /orders` (OMS module)
12. **`order.confirmed`** - Triggered by `POST /orders/{id}/confirm` (OMS module)
13. **`order.cancelled`** - Triggered by `POST /orders/{id}/cancel` (OMS module)
14. **`shipment.created`** - Triggered by `POST /shipments` (OMS module)
15. **`invoice.created`** - Triggered by `POST /invoices` (Finance module)
16. **`payment.received`** - Triggered by `POST /payments` (Finance module)
17. **`webhook.registered`** - Triggered by `POST /webhooks` (Foundation module)

---

## Multi-Tenancy Enforcement

### Request Headers

All endpoints enforce tenant isolation through headers:

```
x-tenant-id: org-uuid-001          # Required for API calls
x-brand-id: brand-uuid-001         # Brand context (storefront)
Authorization: Bearer <jwt_token>  # JWT with tenant_id claim
```

### Row-Level Security (RLS)

Requests pass through middleware that:

1. Extracts `tenant_id` from JWT or header
2. Sets PostgreSQL session variable: `SET app.current_tenant_id = 'org-uuid-001'`
3. All queries automatically filtered by RLS policies
4. Cross-tenant access raises `403 Forbidden` error

### Example: Order Creation with Tenant Isolation

```
POST /orders
x-tenant-id: org-uuid-001

Request body:
{
  "customer_id": "cust-uuid-001",
  "items": [...]
}

Response creates order with:
- tenant_id = org-uuid-001 (from header)
- All related records isolated to this tenant
- Inventory allocation scoped to tenant's locations
- Webhook notifications to tenant's registered endpoints
```

---

## RBAC Scopes

All endpoints are protected by RBAC scopes defined in roles:

### Core Scopes

**Read Scopes**:
- `read:products` - View products, categories, variants
- `read:orders` - View orders and shipments
- `read:inventory` - View stock levels
- `read:procurement` - View POs and suppliers
- `read:finance` - View invoices and payments
- `read:customers` - View customer data

**Write Scopes**:
- `write:products` - Create/edit products
- `write:orders` - Create/modify orders
- `write:inventory` - Adjust inventory
- `write:procurement` - Create/edit POs
- `write:finance` - Create invoices/payments

**Admin Scopes**:
- `admin:users` - User and role management
- `admin:webhooks` - Webhook registration/management
- `admin:plugins` - Plugin installation/activation
- `admin:system` - System configuration

### Example: Endpoint Protection

```yaml
POST /products:
  security:
    - BearerAuth: []
  parameters:
    - x-tenant-id  # Required header
  required_scopes:
    - write:products
  description: Create product requires BearerAuth + write:products scope
```

---

## Error Handling

All endpoints return consistent error responses with correlation IDs for tracing:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid request: quantity must be >= 1",
  "request_id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "validation_errors": [
    {
      "field": "items[0].quantity",
      "message": "must be >= 1"
    }
  ]
}
```

---

## Pagination

List endpoints support cursor-based pagination:

```
GET /products?limit=20&offset=0

Response:
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 487,
    "has_more": true
  }
}
```

**Limits**: 
- Default: 20 records
- Maximum: 100 records per request
- Recommended for large datasets: Use offset pagination for < 10,000 records

---

## Webhook Events

Webhooks notify external systems of domain events. Register via:

```
POST /webhooks
{
  "endpoint_url": "https://partner.example.com/webhooks",
  "event_types": ["order.created", "order.confirmed", "shipment.delivered"]
}
```

### Webhook Payload Format

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "order.created",
  "event_version": "1.0",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "tenant_id": "org-uuid-001",
  "brand_id": "brand-uuid-001",
  "correlation_id": "req-id-123",
  "payload": {
    // Domain-specific event data
  }
}
```

### Webhook Delivery Guarantees

- **Retry Policy**: Exponential backoff (5s, 10s, 20s, 40s, 80s)
- **Max Retries**: 5 attempts over ~2.5 minutes
- **Timeout**: 30 seconds per request
- **Verification**: HMAC-SHA256 signature in `X-Webhook-Signature` header

---

## Schema Examples

### Create Order with Event Cascading

```json
POST /orders
x-tenant-id: org-uuid-001
Authorization: Bearer <token>

{
  "customer_id": "cust-uuid-001",
  "items": [
    {
      "product_id": "prod-uuid-001",
      "quantity": 2
    }
  ],
  "shipping_address": {
    "street": "123 Main St",
    "city": "New York",
    "postal_code": "10001"
  },
  "payment_method": "credit_card"
}

Response (201):
{
  "order_id": "order-uuid-001",
  "status": "pending",
  "total_cents": 17745,
  "created_at": "2024-01-15T10:30:00Z"
}

Events Triggered:
1. order.created → Inventory Service, Finance Service, Fraud Detection
2. inventory.stock_allocated → Fulfillment Service
3. [Plugin hooks execute in order]
```

---

## Compatibility & Linting

All specifications are:
- ✅ **OpenAPI 3.1.0 compliant** - Valid against official schema
- ✅ **Stoplight/Redocly compatible** - Can be rendered in Stoplight Studio
- ✅ **Machine readable** - YAML format for tooling integration
- ✅ **Human readable** - Descriptive summaries and examples

### Validation

```bash
# Validate YAML syntax
yamllint api/openapi/*.yaml

# Validate against OpenAPI 3.1.0 spec
npx @stoplight/spectral-cli lint api/openapi/*.yaml
```

---

## Integration with Event Catalog

The OpenAPI specs and Event Catalog work together:

1. **Endpoint → Event**: Each POST/PATCH/DELETE endpoint documents which event it triggers
2. **Event → Consumers**: Event Catalog documents which services consume each event
3. **Multi-tenant isolation**: Both specs and events include tenant_id for isolation
4. **Audit trail**: Every event and endpoint is audit-logged with actor context

**See Also**: 
- Event Catalog: `/docs/domain/event-catalog.md`
- Configuration Schema: `/docs/config/brand-metadata-schema.md`
- Architecture Blueprint: `/docs/architecture/unified-commerce-os-architecture.md`

---

## Deployment Checklist

Before deploying OpenAPI specs to production:

- [ ] Validate YAML syntax (`yamllint`)
- [ ] Validate against OpenAPI 3.1.0 spec (`spectral`)
- [ ] Test authentication flows (JWT token generation)
- [ ] Verify RLS policies are deployed to PostgreSQL
- [ ] Test webhook delivery with sample events
- [ ] Verify error responses include request IDs
- [ ] Load test pagination endpoints with large datasets
- [ ] Document any custom error codes in runbooks

---

**Last Updated**: 2024-01-16  
**OpenAPI Version**: 3.1.0  
**Specification Status**: Production Ready  
**Phase Coverage**: Phases 1-3 (Identity, PIM, Procurement, Inventory, OMS, Finance, E-Commerce Channels)
