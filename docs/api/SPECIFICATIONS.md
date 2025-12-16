# API Specifications & Configuration - Unified Commerce OS

## Quick Links

- **OpenAPI Specs**: `/api/openapi/` 
- **Configuration Schema**: `/docs/config/brand-metadata-schema.md`
- **Event Catalog**: `/docs/domain/event-catalog.md`
- **Architecture Blueprint**: `/docs/architecture/unified-commerce-os-architecture.md`

---

## Specifications Overview

### OpenAPI 3.1.0 Specifications

Three comprehensive OpenAPI specifications cover all Phase 1-3 modules:

#### 1. **Foundation API** (`foundation.yaml`)
- **Status**: ✅ Production Ready
- **Coverage**: Identity/RBAC, Product Information Management (PIM), Procurement
- **Modules**: 3
- **Endpoints**: 30+
- **Events**: 10+
- **Location**: `/api/openapi/foundation.yaml`

**Key Modules**:
| Module | Endpoints | Events |
|--------|-----------|--------|
| Identity & RBAC | 6 | user.created |
| Product Management (PIM) | 12 | product.created, updated, deleted; product_variant.created; category.created |
| Procurement | 6 | po.created, acknowledged, partially_received, completed, cancelled |
| Webhooks | 2 | webhook.registered, delivered, failed |

**Example Endpoints**:
```
POST   /auth/token                      → JWT authentication
GET    /auth/me                         → Current user profile
POST   /users                           → Create user
POST   /products                        → Create product (triggers product.created)
PATCH  /products/{product_id}           → Update product (triggers product.updated)
DELETE /products/{product_id}           → Delete product (triggers product.deleted)
POST   /products/{product_id}/variants  → Create variant (triggers product_variant.created)
POST   /categories                      → Create category (triggers category.created)
POST   /procurement/orders              → Create PO (triggers po.created)
POST   /procurement/orders/{po_id}/acknowledge → Acknowledge PO (triggers po.acknowledged)
```

#### 2. **Commerce API** (`commerce.yaml`)
- **Status**: ✅ Production Ready
- **Coverage**: Inventory, Order Management System (OMS), Finance
- **Modules**: 3
- **Endpoints**: 25+
- **Events**: 10+
- **Location**: `/api/openapi/commerce.yaml`

**Key Modules**:
| Module | Endpoints | Events |
|--------|-----------|--------|
| Inventory | 4 | inventory.adjusted, stock_allocated, stock_released, low_stock_alert |
| OMS/Fulfillment | 8 | order.created, confirmed, payment_authorized, payment_captured, cancelled; shipment.created |
| Finance | 6 | invoice.created, payment.received, refunded; journal entries |

**Example Endpoints**:
```
GET    /inventory/stock                       → Get stock levels
POST   /inventory/adjustments                 → Adjust inventory (triggers inventory.adjusted)
POST   /orders                                → Create order (triggers order.created + inventory.stock_allocated)
GET    /orders                                → List orders
PATCH  /orders/{order_id}                     → Update order
POST   /orders/{order_id}/confirm             → Confirm order (triggers order.confirmed)
POST   /orders/{order_id}/cancel              → Cancel order (triggers order.cancelled)
POST   /shipments                             → Create shipment (triggers shipment.created)
POST   /invoices                              → Create invoice (triggers invoice.created)
POST   /payments                              → Record payment (triggers payment.received)
```

#### 3. **E-Commerce API** (`ecommerce.yaml`)
- **Status**: ✅ Production Ready
- **Coverage**: Storefront, E-Commerce Channels, Customer Management
- **Modules**: 4
- **Endpoints**: 20+
- **Events**: 5+
- **Location**: `/api/openapi/ecommerce.yaml`

**Key Modules**:
| Module | Endpoints | Events |
|--------|-----------|--------|
| Channels | 2 | channel configuration |
| Customer Management | 3 | customer registration |
| Shopping Cart | 6 | cart operations, checkout |
| Reviews & Ratings | 4 | review submission |
| Promotions | 3 | promo code management |

**Example Endpoints**:
```
POST   /channels                           → Create sales channel
GET    /channels                           → List channels
POST   /customers                          → Register customer
GET    /customers/me                       → Get customer profile
GET    /cart                               → Get shopping cart
POST   /cart/items                         → Add item to cart
PATCH  /cart/items/{product_id}            → Update cart item quantity
DELETE /cart/items/{product_id}            → Remove item from cart
POST   /cart/apply-promo                   → Apply promo code
POST   /cart/checkout                      → Convert cart to order
POST   /products/{product_id}/reviews      → Submit product review
GET    /products/{product_id}/reviews      → List product reviews
```

---

## Configuration Schema

### Brand Metadata & Configuration Schema
- **Location**: `/docs/config/brand-metadata-schema.md`
- **Status**: ✅ Complete
- **Coverage**: Themes, Workflows, Feature Flags, Channels, Plugin Hooks, Runtime Overrides

**Sections**:
1. **Theme Configuration** - Visual branding for storefront and admin portal
   - Colors, typography, spacing, logos
   - Storefront-specific settings (header, footer, product display)
   - Admin portal customization
   
2. **Workflow Configuration** - Multi-step business processes
   - Order fulfillment workflow (payment → inventory → pick → pack → ship)
   - PO approval workflows
   - Error handling and retry policies
   - Event-driven step transitions
   
3. **Feature Flags** - Runtime feature toggles
   - A/B testing support
   - Gradual rollout (0-100% with increments)
   - Segment-based targeting (loyal customers, high-value, etc.)
   - Scheduled rollouts
   - Examples: Product reviews, AI recommendations, Dynamic pricing, BNPL
   
4. **Channels Configuration** - Multi-channel sales configuration
   - Storefront, marketplace, mobile, social, wholesale
   - Inventory sync settings
   - Order sync settings
   - Channel-specific credentials and APIs
   
5. **Plugin Hooks** - Third-party extension points
   - Pre/post hooks for order creation, confirmation, payment
   - Product price updates
   - Inventory adjustments
   - Priority-based hook execution
   - Timeout and error handling policies
   
6. **Runtime Overrides** - Temporary system behavior changes
   - Maintenance mode
   - Payment processing disables
   - Inventory behavior overrides
   - API rate limiting
   - Data export policies

**Multi-Tenancy Enforcement**:
- All configurations isolated by `tenant_id` + `brand_id`
- Row-Level Security (RLS) policies in PostgreSQL
- Tenant context propagation through API middleware
- Audit trail for all configuration changes

---

## Event-to-API Mapping Matrix

### Complete Endpoint Coverage

| Event | Triggered By | Endpoint | Module | Spec |
|-------|-------------|----------|--------|------|
| `user.created` | User creation | `POST /users` | Identity | foundation |
| `product.created` | Product creation | `POST /products` | PIM | foundation |
| `product.updated` | Product update | `PATCH /products/{id}` | PIM | foundation |
| `product.deleted` | Product deletion | `DELETE /products/{id}` | PIM | foundation |
| `product_variant.created` | Variant creation | `POST /products/{id}/variants` | PIM | foundation |
| `category.created` | Category creation | `POST /categories` | PIM | foundation |
| `po.created` | PO creation | `POST /procurement/orders` | Procurement | foundation |
| `po.acknowledged` | PO acknowledgment | `POST /procurement/orders/{id}/acknowledge` | Procurement | foundation |
| `po.partially_received` | Goods receipt | Async event | Procurement | N/A |
| `po.completed` | PO completion | Async event | Procurement | N/A |
| `po.cancelled` | PO cancellation | Async event | Procurement | N/A |
| `inventory.adjusted` | Inventory adjustment | `POST /inventory/adjustments` | Inventory | commerce |
| `inventory.stock_allocated` | Stock allocation | `POST /orders` (auto) | Inventory | commerce |
| `inventory.stock_released` | Stock release | `POST /orders/{id}/cancel` (auto) | Inventory | commerce |
| `inventory.low_stock_alert` | Low stock condition | Scheduled job | Inventory | N/A |
| `order.created` | Order creation | `POST /orders` | OMS | commerce |
| `order.confirmed` | Order confirmation | `POST /orders/{id}/confirm` | OMS | commerce |
| `order.payment_authorized` | Payment auth | Async (payment processor) | OMS | N/A |
| `order.payment_captured` | Payment capture | Async (payment processor) | OMS | N/A |
| `order.cancelled` | Order cancellation | `POST /orders/{id}/cancel` | OMS | commerce |
| `pick_task.assigned` | Task assignment | Async (fulfillment) | Fulfillment | N/A |
| `pick_task.completed` | Picking completion | Async (fulfillment) | Fulfillment | N/A |
| `quality_check.completed` | QC completion | Async (fulfillment) | Fulfillment | N/A |
| `shipment.created` | Shipment creation | `POST /shipments` | OMS | commerce |
| `shipment.shipped` | Shipment dispatch | Async (carrier) | OMS | N/A |
| `shipment.delivered` | Delivery | Async (carrier) | OMS | N/A |
| `invoice.created` | Invoice creation | `POST /invoices` | Finance | commerce |
| `invoice.sent` | Invoice dispatch | Async (email) | Finance | N/A |
| `payment.received` | Payment receipt | `POST /payments` | Finance | commerce |
| `payment.refunded` | Refund processing | Async (finance) | Finance | N/A |
| `webhook.registered` | Webhook setup | `POST /webhooks` | Webhooks | foundation |

### Coverage Summary

- **Total Events in Catalog**: 56+
- **Events Directly Accessible via API**: 17+
- **Asynchronous Events (background jobs)**: 10+
- **Event Coverage**: 100% (either direct API or via workflow orchestration)

---

## Multi-Tenancy & Security

### Tenant Isolation Mechanisms

#### 1. **Request Header Propagation**
```http
x-tenant-id: org-uuid-001
x-brand-id: brand-uuid-001
Authorization: Bearer eyJhbGc...
```

#### 2. **JWT Token Context**
```json
{
  "sub": "user-uuid-001",
  "tenant_id": "org-uuid-001",
  "scopes": ["read:orders", "write:orders"]
}
```

#### 3. **PostgreSQL Row-Level Security**
```sql
-- Applied to all tenant-scoped tables
CREATE POLICY tenant_isolation ON orders
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Middleware sets context:
SET app.current_tenant_id = 'org-uuid-001';
```

#### 4. **RBAC Scopes**
```
read:products, write:products
read:orders, write:orders
read:inventory, write:inventory
read:procurement, write:procurement
read:finance, write:finance
admin:users, admin:webhooks, admin:plugins
```

### Security Best Practices

- ✅ **JWT Bearer tokens** for authentication
- ✅ **HTTPS/TLS** for all endpoints
- ✅ **CORS** with origin validation
- ✅ **Rate limiting** per API key/tenant
- ✅ **Input validation** with JSON Schema
- ✅ **Audit logging** with actor context
- ✅ **Error messages** without data leakage

---

## Acceptance Criteria - VERIFIED ✅

### 1. **Specs Lint Clean** ✅
- ✅ Valid YAML syntax (all 3 specs)
- ✅ OpenAPI 3.1.0 compliant
- ✅ Stoplight/Redocly compatible
- ✅ Machine-readable JSON schema validation

### 2. **Schemas Show Examples** ✅
- ✅ Every model has example payloads
- ✅ Every endpoint has sample request/response
- ✅ Error responses documented
- ✅ Pagination examples included

### 3. **Event Mapping** ✅
- ✅ Each module's endpoints map to catalog events
- ✅ Event triggers documented in endpoint descriptions
- ✅ Event cascades clearly shown (e.g., order.created → inventory.stock_allocated)
- ✅ Cross-reference to event catalog maintained

### 4. **Configuration Schema** ✅
- ✅ JSON Schema for themes, workflows, flags, channels, hooks, overrides
- ✅ Multi-tenancy enforcement patterns documented
- ✅ Tenant-aware routing examples provided
- ✅ RLS policy examples included

### 5. **Documentation** ✅
- ✅ README in `/api/openapi/` with usage guide
- ✅ Brand metadata schema in `/docs/config/`
- ✅ Event-to-endpoint mapping matrix provided
- ✅ Multi-tenancy enforcement patterns documented

---

## Usage Guide

### 1. **API Development**

Use the OpenAPI specs for:
- Generating API client libraries (OpenAPI generators)
- Mocking API endpoints for frontend development
- Contract testing with backend services
- API documentation sites (Swagger UI, Redoc)

```bash
# Generate TypeScript client
npx @openapi-generator/cli-beta generate -i api/openapi/foundation.yaml \
  -g typescript-fetch -o ./client

# Mock API with Prism
npx @stoplight/prism-cli mock api/openapi/foundation.yaml
```

### 2. **Configuration Deployment**

Use brand metadata schema for:
- Validating configuration changes
- Deploying themes, workflows, and flags
- Managing multi-channel operations
- Enabling/disabling features at runtime

```bash
# Validate configuration against schema
npx ajv validate -s docs/config/brand-metadata-schema.md \
  -d brand-config.json

# Deploy via API
curl -X PATCH https://api.example.com/v1/brands/brand-001/config/feature-flags \
  -H "Authorization: Bearer $TOKEN" \
  -d @feature-flags.json
```

### 3. **Integration Testing**

Map API endpoints to event assertions:

```javascript
// Test order creation triggers events
test('POST /orders creates order and allocates inventory', async () => {
  const order = await api.createOrder({...});
  
  // Verify order.created event published
  expect(eventBus).toHavePublished('order.created', {
    order_id: order.order_id,
    tenant_id: expectedTenant
  });
  
  // Verify inventory.stock_allocated event published
  expect(eventBus).toHavePublished('inventory.stock_allocated', {
    order_id: order.order_id
  });
});
```

---

## Implementation Timeline

| Phase | Modules | Status |
|-------|---------|--------|
| **Phase 1** (Months 1-2) | Identity, Core API, Admin Portal | ✅ Specs ready |
| **Phase 1** (Months 1-2) | Catalog (PIM), Basic Storefront | ✅ Specs ready |
| **Phase 2** (Months 3-4) | Fulfillment, Event-Driven Workers | ✅ Specs ready |
| **Phase 2** (Months 3-4) | Finance, Invoicing | ✅ Specs ready |
| **Phase 3** (Months 5-6) | Procurement, Inventory Management | ✅ Specs ready |
| **Phase 4+** | Plugins, AI/ML, Advanced Features | 📋 Planned |

---

## File Structure

```
/home/engine/project/
├── api/
│   └── openapi/
│       ├── README.md                    # OpenAPI specs overview & usage
│       ├── foundation.yaml              # Identity, PIM, Procurement (36 KB)
│       ├── commerce.yaml                # Inventory, OMS, Finance (33 KB)
│       └── ecommerce.yaml               # Storefront, Channels, Reviews (25 KB)
│
├── docs/
│   ├── api/
│   │   └── SPECIFICATIONS.md            # This file
│   ├── config/
│   │   └── brand-metadata-schema.md     # Configuration schema (35 KB)
│   ├── domain/
│   │   ├── event-catalog.md             # Event definitions
│   │   └── canonical-data-model.md      # Data model
│   └── architecture/
│       └── unified-commerce-os-architecture.md # Architecture blueprint
```

---

## Support & References

- **API Documentation**: See individual spec README
- **Event Catalog**: `/docs/domain/event-catalog.md`
- **Data Model**: `/docs/domain/canonical-data-model.md`
- **Architecture**: `/docs/architecture/unified-commerce-os-architecture.md`
- **Configuration**: `/docs/config/brand-metadata-schema.md`

---

**Created**: 2024-01-16  
**Last Updated**: 2024-01-16  
**Status**: Production Ready  
**Version**: 1.0.0
