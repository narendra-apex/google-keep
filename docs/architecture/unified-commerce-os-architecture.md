# Unified Commerce OS - Multi-Tenant Architecture Blueprint

## Executive Summary

The Unified Commerce OS is a modular, multi-tenant SaaS platform designed to orchestrate complex commerce workflows across procurement, inventory, fulfillment, and finance domains. Built on Bun.js runtime, the system leverages a service-oriented topology with event-driven communication, tenant isolation through Row-Level Security (RLS) and schema strategies, and a configuration-driven customization layer enabling rapid deployment across diverse brand requirements.

This blueprint establishes the architectural foundation and identifies Phase 1 prerequisites that enable downstream phases to build upon proven patterns and data models.

---

## 1. Core Architecture Principles

### 1.1 Multi-Tenancy Strategy

The platform implements a **hybrid multi-tenancy model**:

- **Logical Isolation (Primary)**: RLS policies and tenant context propagation through application layers
- **Physical Isolation (Optional)**: Schema-per-tenant for enhanced data segregation in high-compliance scenarios
- **Shared Infrastructure**: Common data store cluster with tenant routing at application layer

```
┌─────────────────────────────────────────────────────────────┐
│                    Multi-Tenant Deployment                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Tenant A    Tenant B    Tenant C    Tenant N              │
│  ────────    ────────    ────────    ───────               │
│    │           │           │           │                   │
│    └───────────┴───────────┴───────────┘                   │
│                   │                                         │
│         Tenant Context Propagation                         │
│         (API Gateway / Context Middleware)                 │
│                   │                                         │
│    ┌──────────────┼──────────────┬──────────────┐         │
│    │              │              │              │         │
│  Postgres      Redis       ClickHouse       Meilisearch    │
│  (RLS & Schemas) (Sessions,  (Analytics)    (Search)      │
│                  Cache)                                    │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Architectural Tenets

1. **Event-Driven Core**: State changes propagate via NATS/Kafka, ensuring eventual consistency
2. **API-First Design**: GraphQL and REST endpoints through Hono/Elysia APIs
3. **Composable Services**: Modular microservices interconnected via event spine and synchronous RPC
4. **Configuration Over Code**: Feature flags, workflows, UI schemas defined as data
5. **Observable by Default**: Structured logging, distributed tracing, metrics at every layer
6. **Secure by Default**: Encryption in transit/at-rest, RLS enforcement, audit trails

---

## 2. Service Topology

### 2.1 Overview Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Client Layer (Browser/Mobile)                    │
├──────────────────────────────────────────────────────────────────────┤
│  Admin Portal (Next.js)  │  Headless Storefront (Next.js/Remix/Vue) │
│  Control Tower Dashboard │  Brand Storefront UIs                     │
└──────────────────────────────────────────────────────────────────────┘
                               │
                         ┌─────┴─────┐
                         │ TLS/mTLS  │
                         └─────┬─────┘
                               │
┌──────────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer (Kong/Tyk)                    │
│  Rate Limiting │ Auth │ Request Logging │ Tenant Routing             │
└──────────────────────────────────────────────────────────────────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
        ┌───────▼────────┐ ┌──▼───────┐ ┌───▼────────┐
        │  Hono/Elysia   │ │ Hono/    │ │ Hono/      │
        │  Core API      │ │ Elysia   │ │ Elysia     │
        │  (GraphQL/REST)│ │ Catalog  │ │ Fulfillment│
        │                │ │ Service  │ │ Service    │
        │ • Procure-     │ │          │ │            │
        │   ment         │ │ • Prod   │ │ • Order    │
        │ • Inventory    │ │   Mgmt   │ │   Shipping │
        │ • Finance      │ │ • Pricing│ │ • Returns  │
        │ • Subscriptions│ │ • Search │ │            │
        └────┬───────────┘ └──┬───────┘ └───┬────────┘
             │                │              │
             └────────────────┼──────────────┘
                              │
                     Event & Command Bus
                     (NATS/Kafka Cluster)
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
    ┌────▼────┐         ┌─────▼──┐         ┌──────▼───┐
    │ Workers │         │Plugins │         │Integrations│
    │         │         │System  │         │Hub        │
    │ • Async │         │        │         │           │
    │   Tasks │         │Custom  │         │• Stripe   │
    │ • Email │         │Logic   │         │• Shopify  │
    │ • Webhks│         │Layer   │         │• WMS/ERP  │
    └─────────┘         └────────┘         └───────────┘
```

### 2.2 Service Components

#### 2.2.1 Core API Service (Primary Orchestrator)

**Technology**: Hono/Elysia running on Bun.js

**Responsibilities**:
- Authentication & Authorization (JWT + tenant context)
- Procurement workflows (PO management, supplier interactions)
- Inventory management (stock levels, allocations)
- Financial transactions (invoicing, accounting integration)
- Subscription management (recurring billing)
- Tenant configuration & schema management

**Key Endpoints**:
```
POST   /api/v1/procurement/orders
GET    /api/v1/inventory/products
POST   /api/v1/finance/invoices
POST   /api/v1/subscriptions
GET    /api/v1/tenant/config
```

**Tenant Context Propagation**:
```typescript
// Middleware example
app.use(async (c, next) => {
  const tenantId = c.req.header('x-tenant-id') || 
                   extractFromJWT(c.req.header('authorization'));
  c.set('tenant', { id: tenantId, userId: extractUserId(...) });
  await next();
});
```

#### 2.2.2 Catalog Service

**Technology**: Hono/Elysia on Bun.js

**Responsibilities**:
- Product & variant management
- Pricing engine (multi-currency, tiering, promotions)
- Search indexing coordination (Meilisearch)
- Category & attribute management
- Configuration-driven product customization

**Integration Points**:
- Publishes `product.created`, `product.updated`, `product.deleted` events
- Subscribes to inventory changes for stock sync
- Consumes pricing events from finance service

#### 2.2.3 Fulfillment Service

**Technology**: Hono/Elysia on Bun.js

**Responsibilities**:
- Order fulfillment workflows
- Shipping & logistics orchestration
- Returns & RMA management
- Warehouse management system (WMS) integration
- Tracking & delivery notifications

**Key Workflows**:
```
Order Placed → Pick/Pack → QC Check → Label → Ship → Deliver → Return
     ↓             ↓           ↓        ↓      ↓       ↓        ↓
Event: order.created
              pick_task.assigned
                         qc_completed
                                    label_generated
                                                 shipment.created
```

#### 2.2.4 Admin Portal (Next.js)

**Responsibilities**:
- Tenant administration (users, roles, permissions)
- Dashboard & reporting views
- Configuration management (feature flags, workflows)
- Multi-brand control tower interface
- System monitoring & health checks

**Key Pages**:
- `/admin/dashboard` - KPIs, trends, alerts
- `/admin/tenants` - Tenant management
- `/admin/workflows` - Configuration-driven workflow builder
- `/admin/integrations` - Third-party connections

#### 2.2.5 Headless Storefront (Next.js/Alternative Frameworks)

**Responsibilities**:
- B2C/B2B storefront UI
- Shopping cart & checkout
- Customer account management
- Order history & tracking
- Review & rating system

**API Integration**: Communicates exclusively with Core API via public REST/GraphQL

#### 2.2.6 Plugin System Service

**Responsibilities**:
- Plugin discovery & lifecycle management
- Sandboxed execution environment
- Event subscription & hook registration
- Configuration storage per plugin

**Plugin Types**:
- **Validators**: Pre/post action validation logic
- **Transformers**: Data transformation pipelines
- **Actions**: Custom business logic handlers
- **UI Extensions**: Custom admin dashboard components
- **Integrations**: Third-party system connectors

**Plugin Execution Model**:
```
Event Published → Trigger Matching Hooks → Execute Plugins in Isolation
                                         → Log Execution → Update State
```

#### 2.2.7 Worker Queue Service

**Technology**: Bull (Redis-backed) or Kafka Streams

**Responsibilities**:
- Asynchronous task processing
- Email/notification delivery
- Webhook execution
- Scheduled jobs (reconciliation, cleanup)
- Data exports & imports

**Job Types**:
- Email notifications (order confirmation, shipment)
- Webhook retries with exponential backoff
- Daily reconciliation jobs
- Data export jobs (CSV, XML)

#### 2.2.8 Integration Hub

**Responsibilities**:
- Third-party system connectors
- API adapters for external services
- Webhook handlers for inbound events
- Transform & map external data to internal models

**Supported Integrations**:
- **Payment**: Stripe, PayPal, Square
- **Shipping**: FedEx, UPS, ShipStation
- **ERP/Accounting**: NetSuite, QuickBooks, SAP
- **WMS**: Manhattan, Blue Yonder, TraceLink
- **Custom**: Extensible adapter pattern

---

## 3. Data Layer Architecture

### 3.1 Data Store Selection

```
┌────────────────────────────────────────────────────────┐
│                    Data Stores Layer                   │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Postgres        Redis          ClickHouse    Meilisearch
│  (Primary DB)    (Cache/Queue)  (Analytics)   (Search)
│  • RLS Enabled   • Sessions      • Events      • Product
│  • Schemas       • Rate Limits   • Metrics     • Catalog
│  • JSONB Fields  • Pub/Sub       • Logs        • Full-text
│  • Audit Logs    • Leaderboards  • Dimensions │ Filters
│                                                        │
└────────────────────────────────────────────────────────┘
```

### 3.2 PostgreSQL (Primary Data Store)

**Role**: System of record for all transactional data

**Multi-Tenancy Implementation**:

```sql
-- Schema-per-tenant approach (optional higher isolation)
-- CREATE SCHEMA tenant_a;
-- CREATE SCHEMA tenant_b;

-- OR Row-Level Security approach (primary)
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  price_cents BIGINT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, sku)
);

-- RLS Policy
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON products
  USING (tenant_id = CURRENT_SETTING('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = CURRENT_SETTING('app.current_tenant_id')::uuid);
```

**Core Tables**:
- `tenants` - Tenant metadata, subscription info
- `users` - User accounts with tenant assignments
- `roles` & `permissions` - RBAC
- `products` - Product catalog
- `inventory` - Stock levels per warehouse
- `orders` - Customer orders
- `order_items` - Line items
- `procurement_orders` - Supplier POs
- `invoices` - Financial records
- `subscriptions` - Recurring billing
- `audit_logs` - Change tracking
- `webhooks` - Webhook subscriptions per tenant
- `plugins_config` - Plugin settings

**Scaling Strategy**:
- Replication for read scaling
- Connection pooling via PgBouncer
- Partitioning by tenant_id for very large tables
- Logical replication for analytics DB

### 3.3 Redis (Session & Cache Store)

**Responsibilities**:
- Session storage with TTL
- Rate limit tracking
- Distributed cache layer
- Pub/Sub for real-time features
- Bull job queue (workers)

**Key-Value Patterns**:
```
session:{session_id} -> {user, tenant, permissions}
rate_limit:{tenant_id}:{endpoint} -> {count, window}
cache:product:{product_id} -> {product_data}
queue:email -> {job_id, payload, retry_count}
```

### 3.4 ClickHouse (Analytics & Event Storage)

**Responsibilities**:
- Time-series analytics
- Event stream ingestion
- Metrics aggregation
- Audit trail storage
- Business intelligence queries

**Key Tables**:
- `events` - All domain events with timestamps
- `metrics` - Service metrics (latency, errors)
- `logs` - Structured application logs
- `audit_trail` - All state changes for compliance

**Event Schema**:
```sql
CREATE TABLE events (
  timestamp DateTime,
  tenant_id UUID,
  event_type String,
  entity_type String,
  entity_id UUID,
  actor_id UUID,
  payload JSON,
  metadata JSON
) ENGINE = MergeTree()
ORDER BY (timestamp, tenant_id)
PARTITION BY toYYYYMM(timestamp);
```

### 3.5 Meilisearch (Full-Text Search)

**Responsibilities**:
- Product search with faceting
- Typo tolerance & synonym support
- Real-time indexing coordination
- Multi-language support

**Indexes**:
- `products_{tenant_id}` - Tenant-scoped product search
- `orders_{tenant_id}` - Order search by customer
- `suppliers_{tenant_id}` - Supplier search

---

## 4. Event-Driven Communication

### 4.1 NATS/Kafka Event Bus

The platform uses **NATS** for low-latency command/request patterns and **Kafka** for durable event streaming.

```
┌──────────────────────────────────────────────────────┐
│            Event Spine (NATS + Kafka)               │
├──────────────────────────────────────────────────────┤
│                                                      │
│  NATS (Low Latency, Request/Reply)                 │
│  • Synchronous command processing                   │
│  • RPC-style microservice communication             │
│  • Real-time dashboards updates                     │
│                                                      │
│  Kafka (Durable Event Streaming)                    │
│  • Event sourcing & replay capability               │
│  • Multi-subscriber patterns                        │
│  • Compliance audit trails                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 4.2 Core Event Types

**Domain Events** (published by services):

```
Procurement Domain:
  - po.created(po_id, supplier_id, items, total)
  - po.acknowledged(po_id, ack_date)
  - po.partially_received(po_id, items_received)
  - po.completed(po_id)

Inventory Domain:
  - stock.allocated(product_id, quantity, order_id)
  - stock.reserved(product_id, quantity, expiry)
  - stock.released(product_id, quantity, reason)
  - inventory.adjusted(product_id, old_qty, new_qty, reason)

Fulfillment Domain:
  - order.created(order_id, customer_id, items, total)
  - order.confirmed(order_id, shipping_address)
  - pick_task.assigned(task_id, warehouse_id, picker_id)
  - shipment.created(shipment_id, tracking_number)
  - shipment.delivered(shipment_id, delivery_time)

Finance Domain:
  - invoice.created(invoice_id, order_id, amount)
  - payment.received(invoice_id, amount, method)
  - payment.failed(invoice_id, reason)
  - reconciliation.completed(batch_id, variance)
```

### 4.3 Event Flow Example: Order Processing

```
┌─────────────────────────────────────────────────────────────┐
│             Procurement → Finance Flow Sequence             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. PO Creation (Core API)                                │
│     input: {supplier, items, quantities}                 │
│     │                                                    │
│     ├─► validate_supplier() [Plugin Hook]               │
│     ├─► update DB: INSERT procurement_orders            │
│     ├─► NATS: po.created (Core API)                     │
│     └─► Kafka: po.created (for audit)                   │
│                                                          │
│  2. PO Acknowledgment (Supplier System)                 │
│     event: po.created                                   │
│     │                                                   │
│     ├─► Integration Hub picks up event                 │
│     ├─► Calls supplier API                             │
│     ├─► Receives ACK + delivery schedule               │
│     └─► publishes po.acknowledged event                │
│                                                          │
│  3. Goods Receipt (Warehouse WMS)                       │
│     event: po.acknowledged                             │
│     │                                                   │
│     ├─► WMS integration receives                        │
│     ├─► Goods received scan                            │
│     ├─► Inventory Service updates stock               │
│     └─► publishes stock.received event                │
│                                                          │
│  4. Invoice Generation (Finance Service)               │
│     event: po.partially_received or po.completed       │
│     │                                                   │
│     ├─► Finance Service subscribes                    │
│     ├─► Creates invoice record                        │
│     ├─► Calculate taxes & shipping                    │
│     ├─► Apply payment terms                           │
│     └─► publishes invoice.created event              │
│                                                          │
│  5. Payment Processing                                │
│     event: invoice.created                            │
│     │                                                   │
│     ├─► Payment Service processes                     │
│     ├─► Records payment in ledger                     │
│     ├─► Updates accounting integration                │
│     └─► publishes payment.received event             │
│                                                          │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 Event Consumer Pattern

```typescript
// Example: Finance Service subscribing to inventory events
import { Kafka } from 'kafkajs';

const kafka = new Kafka({ brokers: ['kafka:9092'] });
const consumer = kafka.consumer({ groupId: 'finance-service' });

await consumer.subscribe({ topic: 'inventory.events', fromBeginning: false });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());
    
    if (event.type === 'stock.received') {
      const { po_id, items_received, total_cost } = event;
      
      // Create invoice
      const invoice = await createInvoice({
        procurement_order_id: po_id,
        amount_cents: total_cost,
        items: items_received,
      });
      
      // Publish event
      await producer.send({
        topic: 'finance.events',
        messages: [{
          key: invoice.id,
          value: JSON.stringify({
            type: 'invoice.created',
            invoice_id: invoice.id,
            po_id,
            timestamp: new Date(),
          }),
        }],
      });
    }
  },
});
```

---

## 5. Dashboard Architecture

### 5.1 Control Tower vs Brand Dashboards

**Control Tower Dashboard** (Admin Portal - Next.js)
- **Audience**: System administrators, operations managers, support team
- **Access**: Single unified view across all tenants
- **Key Metrics**:
  - Total orders/revenue across all brands
  - System health & service status
  - Tenant usage & utilization
  - Anomalies & alerts
- **Features**:
  - Tenant management & provisioning
  - Role & permission administration
  - System configuration
  - Audit logs & compliance reports

```
┌─────────────────────────────────────────┐
│     Control Tower Dashboard             │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  System Overview                  │ │
│  │  • 45 Active Tenants              │ │
│  │  • $2.3M Revenue (This Month)     │ │
│  │  • 12,450 Orders (Processing)     │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Tenant Health Status             │ │
│  │  • Brand A: Healthy (CPU 45%)     │ │
│  │  • Brand B: Degraded (Queues: 5K) │ │
│  │  • Brand C: Alert (DB Conn: 98%)  │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Recent Alerts                    │ │
│  │  • High latency detected (Brand B)│ │
│  │  • Failed payment webhook (Brand A)│ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

**Brand Dashboards** (Multi-tenant UI)
- **Audience**: Brand operators, store managers, finance team
- **Access**: Isolated to their tenant data only (enforced via RLS/filters)
- **Key Metrics**:
  - Orders, revenue, conversion rate
  - Inventory levels by product/warehouse
  - Fulfillment performance
  - Customer acquisition & retention
  - Procurement spend & PO status
- **Features**:
  - Real-time order management
  - Inventory forecasting & reorder points
  - Financial reconciliation
  - Supplier performance tracking
  - Workflow configuration

```
┌─────────────────────────────────────────┐
│     Brand Dashboard (Brand A)           │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Sales Performance                │ │
│  │  • Orders Today: 245              │ │
│  │  • Revenue Today: $18,950         │ │
│  │  • Avg Order Value: $77.35        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Inventory Snapshot               │ │
│  │  • Total SKUs: 1,250              │ │
│  │  • Low Stock Alerts: 23           │ │
│  │  • Warehouse A: 45,230 units      │ │
│  │  • Warehouse B: 32,100 units      │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │  Fulfillment Metrics              │ │
│  │  • On-Time Rate: 96.2%            │ │
│  │  • Avg Ship Time: 1.3 days        │ │
│  │  • Return Rate: 2.8%              │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### 5.2 Dashboard Data Pipeline

```
┌────────────────────────────────────┐
│   Real-Time Events (Kafka/NATS)   │
└────────────┬───────────────────────┘
             │
    ┌────────▼────────┐
    │  Event Stream   │
    │  Processor      │
    └────────┬────────┘
             │
    ┌────────▼──────────────────┐
    │  Aggregate & Transform    │
    │  • Time-bucket metrics    │
    │  • Calculate KPIs         │
    │  • Denormalize for quick  │
    │    retrieval              │
    └────────┬──────────────────┘
             │
    ┌────────▼──────────────────┐
    │  Store in ClickHouse      │
    │  (Columnar OLAP DB)       │
    └────────┬──────────────────┘
             │
    ┌────────▼──────────────────┐
    │  Serve via API            │
    │  (GraphQL subscriptions)  │
    └────────┬──────────────────┘
             │
    ┌────────▼──────────────────┐
    │  Client Dashboards        │
    │  (WebSockets + React)     │
    └──────────────────────────┘
```

---

## 6. Plugin System Architecture

### 6.1 Plugin Lifecycle & Execution

The plugin system enables configuration-driven customization through sandboxed code execution.

```
┌──────────────────────────────────────────────────────────┐
│               Plugin System Lifecycle                    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  INSTALL PHASE                                          │
│  • Upload plugin bundle (ZIP or published registry)     │
│  • Validate manifest & permissions                      │
│  • Store in plugin repository                           │
│                                                          │
│  ACTIVATE PHASE                                         │
│  • Load plugin into memory (VM or process)             │
│  • Register event hooks & subscriptions                │
│  • Initialize plugin storage (config, state)           │
│                                                          │
│  EXECUTION PHASE                                        │
│  • Event triggered → matching hooks located             │
│  • Plugin code executed in sandbox                      │
│  • Results merged into main execution flow             │
│                                                          │
│  DEACTIVATE/REMOVE PHASE                               │
│  • Unregister hooks                                     │
│  • Clean up plugin storage                             │
│  • Remove from registry                                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 6.2 Plugin Types & Hook Points

**1. Validator Plugins**
- Execute before (PRE) or after (POST) state changes
- Return success/failure + error messages
- Example: Custom fraud detection on order creation

```javascript
// Plugin: fraud-detector-premium
const plugin = {
  id: 'fraud-detector-premium',
  version: '1.0.0',
  hooks: {
    'order.create:pre': async (context) => {
      const { order, tenant } = context;
      const riskScore = await analyzeOrder(order, tenant);
      if (riskScore > 0.8) {
        return {
          valid: false,
          error: 'High fraud risk detected',
          data: { riskScore, reason: 'Multiple declined cards' }
        };
      }
      return { valid: true };
    }
  }
};
```

**2. Transformer Plugins**
- Modify data structures in pipelines
- Example: Apply custom taxation rules

```javascript
// Plugin: custom-tax-calculator
const plugin = {
  hooks: {
    'invoice.calculate_tax:transform': async (context) => {
      const { lineItems, shippingAddress, tenant } = context;
      const customTaxRules = await getTaxRules(tenant);
      return {
        ...context,
        taxAmount: calculateCustomTax(lineItems, customTaxRules),
      };
    }
  }
};
```

**3. Action Plugins**
- Custom business logic handlers
- Example: Send to specialized fulfillment for luxury items

```javascript
// Plugin: luxury-fulfillment-handler
const plugin = {
  hooks: {
    'order.confirmed:action': async (context) => {
      const { order, items } = context;
      const luxuryItems = items.filter(i => i.tags.includes('luxury'));
      
      if (luxuryItems.length > 0) {
        await sendToSpecialFulfillment(order, luxuryItems);
      }
    }
  }
};
```

**4. UI Extension Plugins**
- Add custom components to admin dashboard
- Example: Custom analytics visualization

```javascript
// Plugin: inventory-forecast-widget
const plugin = {
  type: 'ui-extension',
  component: {
    id: 'inventory-forecast',
    route: '/dashboard/forecast',
    component: ForecastChart, // React component
    requiredPermissions: ['analytics:read']
  }
};
```

**5. Integration Plugins**
- Connect external systems
- Example: Custom ERP integration

```javascript
// Plugin: custom-erp-sync
const plugin = {
  hooks: {
    'invoice.created:integration': async (context) => {
      const { invoice, tenant } = context;
      const erpConfig = await getERPConfig(tenant);
      
      await callERPAPI({
        endpoint: erpConfig.url,
        method: 'POST',
        path: '/api/invoices',
        body: transformToERPFormat(invoice),
        headers: { Authorization: `Bearer ${erpConfig.token}` }
      });
    }
  }
};
```

### 6.3 Plugin Manifest

```json
{
  "id": "inventory-optimizer",
  "name": "Inventory Optimizer",
  "version": "2.1.0",
  "author": "Acme Corp",
  "description": "ML-powered inventory reorder optimization",
  "permissions": [
    "inventory:read",
    "inventory:write",
    "procurement:write",
    "analytics:read"
  ],
  "hooks": [
    {
      "event": "stock.low_alert",
      "type": "action",
      "handler": "src/handlers/generatePO.js"
    },
    {
      "event": "procurement:calculate_reorder_point",
      "type": "transformer",
      "handler": "src/transformers/mlReorder.js"
    }
  ],
  "config": {
    "mlModel": "linear-regression-v2",
    "forecastDays": 30,
    "minStockDays": 7
  },
  "dependencies": {
    "ml-lib": "^1.5.0",
    "statistics": "^4.0.0"
  }
}
```

---

## 7. Configuration-Driven Customization

### 7.1 Workflow Engine

Tenants define order processing workflows as configuration without code changes:

```yaml
# Brand A: Standard E-commerce Workflow
workflows:
  order_fulfillment:
    id: order_fulfillment_v1
    trigger: order.created
    steps:
      - id: validate_inventory
        type: condition
        if:
          operator: gte
          path: order.total_quantity
          value: inventory.available
        then:
          - action: allocate_inventory
          - action: create_picking_task
        else:
          - action: send_backorder_notification
          - action: subscribe_to_stock_notification
      
      - id: calculate_shipping
        type: service_call
        service: shipping_calculator
        params:
          destination: order.shipping_address
          weight: order.total_weight
      
      - id: payment_processing
        type: plugin_hook
        hook: process_payment
        
      - id: create_shipment
        type: service_call
        service: fulfillment
        params:
          order_id: order.id
          warehouse: inventory.closest_warehouse

    error_handling:
      - on: payment_failed
        action: send_email
        template: payment_failed_notification

# Brand B: B2B with Approval Workflow
workflows:
  order_fulfillment:
    id: order_fulfillment_b2b_v1
    trigger: order.created
    steps:
      - id: approval_check
        type: condition
        if:
          operator: gt
          path: order.total_amount
          value: 50000  # > $500
        then:
          - action: create_approval_task
          - action: notify_approvers
          - action: wait_for_approval
        else:
          - next_step: validate_inventory
      
      - id: validate_inventory
        type: condition
        if: inventory.available >= order.quantity
        then:
          - action: allocate_inventory
        else:
          - action: notify_supplier_for_dropship
```

### 7.2 Feature Flags & Tenant Experimentation

```json
{
  "feature_flags": [
    {
      "id": "new_checkout_ui",
      "enabled": true,
      "rollout_percent": 25,
      "targeted_tenants": ["brand-premium"],
      "config": {
        "variant": "v2_minimal",
        "payment_providers": ["stripe", "paypal"]
      }
    },
    {
      "id": "inventory_forecasting",
      "enabled": true,
      "rollout_percent": 100,
      "config": {
        "forecast_days": 30,
        "reorder_method": "ml"
      },
      "tenant_overrides": {
        "brand_basic": {
          "enabled": false
        },
        "brand_enterprise": {
          "forecast_days": 90
        }
      }
    }
  ]
}
```

### 7.3 UI Schema Configuration

```json
{
  "ui_schemas": {
    "product_form": {
      "sections": [
        {
          "id": "basic_info",
          "label": "Product Information",
          "fields": [
            {
              "id": "name",
              "type": "text",
              "label": "Product Name",
              "required": true,
              "validation": "^[a-zA-Z0-9 ]{3,100}$"
            },
            {
              "id": "category",
              "type": "select",
              "label": "Category",
              "options_source": "/api/categories",
              "required": true
            }
          ]
        },
        {
          "id": "pricing",
          "label": "Pricing & Currency",
          "condition": "tenant.tier >= 'pro'",
          "fields": [
            {
              "id": "base_price",
              "type": "currency",
              "currencies": ["USD", "EUR", "GBP"],
              "required": true
            },
            {
              "id": "tier_pricing",
              "type": "nested_table",
              "columns": ["min_quantity", "price"],
              "max_rows": 10
            }
          ]
        }
      ]
    }
  }
}
```

---

## 8. Deployment & Observability

### 8.1 Deployment Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                  Deployment Topology                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Production Environment                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Kubernetes Cluster (Multi-AZ)                        │ │
│  │                                                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │ │
│  │  │ Ingress /    │  │ Service Mesh │  │ Pod        │  │ │
│  │  │ Load Balancer│  │ (Istio/Linkerd) │ Orchestr. │  │ │
│  │  └──────────────┘  └──────────────┘  └────────────┘  │ │
│  │                                                        │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐        │ │
│  │  │ Core API   │ │ Catalog    │ │ Fulfillment│ (x3    │ │
│  │  │ (Bun/Hono) │ │ Service    │ │ Service    │ replicas│ │
│  │  └────────────┘ └────────────┘ └────────────┘        │ │
│  │                                                        │ │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐        │ │
│  │  │ Admin      │ │ Storefront │ │ Worker Pool│        │ │
│  │  │ Portal     │ │            │ │            │        │ │
│  │  │ (Next.js)  │ │ (Next.js)  │ │ (Bun Jobs) │        │ │
│  │  └────────────┘ └────────────┘ └────────────┘        │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  Stateful Services                               │ │ │
│  │  │  • PostgreSQL (Primary + Replicas)              │ │ │
│  │  │  • Redis Cluster (Sessions + Cache)             │ │ │
│  │  │  • NATS Cluster (Command Bus)                   │ │ │
│  │  │  • Kafka Cluster (Event Stream)                 │ │ │
│  │  │  • ClickHouse (Analytics)                       │ │ │
│  │  │  • Meilisearch (Search)                         │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Staging Environment (Mirror of Prod)                       │
│  Sandbox Environment (Tenant Testing)                       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 High Availability & Scaling

**Service Replication**:
- Stateless services: 3+ replicas per AZ
- Rolling updates via Kubernetes
- Health checks & auto-recovery
- Circuit breakers & bulkheads

**Data Replication**:
- PostgreSQL: Primary + Synchronous Replication (HA)
- Redis: Cluster mode with 3 master nodes
- NATS: Clustered deployment across AZs
- Kafka: 3+ broker cluster with replication factor 3

**Load Balancing**:
```
┌─────────────────────────┐
│   AWS ALB / Nginx       │
│   (Layer 7 routing)     │
└────────┬────────────────┘
         │
    ┌────┴────┬───────────┐
    │          │           │
    ▼          ▼           ▼
┌────────┐ ┌────────┐ ┌────────┐
│API Pod1│ │API Pod2│ │API Pod3│
└────────┘ └────────┘ └────────┘
```

### 8.3 Observability Stack

```
┌──────────────────────────────────────────────────────┐
│          Observability & Monitoring Stack           │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Application Instrumentation                        │
│  ├─ OpenTelemetry (traces, metrics, logs)          │
│  ├─ Structured logging (JSON format)               │
│  └─ Performance monitoring                          │
│                                                      │
│  Metrics Collection                                 │
│  ├─ Prometheus (scrape-based metrics)              │
│  ├─ Custom metrics (business KPIs)                 │
│  └─ Host metrics (CPU, memory, disk)               │
│                                                      │
│  Log Aggregation                                    │
│  ├─ ELK Stack or Splunk (log indexing)             │
│  ├─ Log streaming (Kafka → S3)                     │
│  └─ Audit trail archival (compliance)              │
│                                                      │
│  Distributed Tracing                                │
│  ├─ Jaeger (trace collection)                      │
│  ├─ Request path visualization                     │
│  └─ Performance bottleneck identification          │
│                                                      │
│  Visualization & Alerting                          │
│  ├─ Grafana (dashboards)                           │
│  ├─ PagerDuty (incident management)                │
│  └─ Custom alerting rules                          │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### 8.4 Key Metrics & Dashboards

**SLA Metrics**:
```
• API latency (p50, p99, p99.9)
• Error rate by endpoint
• Availability (uptime %)
• Queue depth & processing latency
```

**Business Metrics**:
```
• Orders/hour (throughput)
• Payment success rate
• Fulfillment time (order → shipped)
• Inventory turnover ratio
• Tenant activation rate
```

**Operational Metrics**:
```
• Database connection pool utilization
• Cache hit ratio (Redis)
• Message processing lag (Kafka consumer)
• Plugin execution time & errors
• API gateway rate limiting events
```

---

## 9. Phase-Based Architecture Roadmap

### 9.1 Phase 1: Foundation (Months 1-2)

**Objectives**: Establish multi-tenant core, basic order flow, and operational foundation.

**Core Components**:
1. **Authentication & Tenancy**
   - JWT-based multi-tenant authentication
   - PostgreSQL schema with RLS policies
   - Tenant context propagation middleware

2. **Core API Service** (Hono/Elysia)
   - Basic CRUD endpoints for: products, orders, inventory
   - GraphQL schema for core entities
   - Error handling & validation

3. **PostgreSQL Setup**
   - Primary DB with replication setup
   - RLS policies on all tables
   - Audit logging infrastructure

4. **Redis Cache**
   - Session store
   - Rate limiting layer
   - Basic query caching

5. **Admin Portal** (Next.js)
   - Tenant management UI
   - Basic order & product management
   - User/role administration

6. **Headless Storefront** (Next.js)
   - Product listing & search
   - Shopping cart
   - Checkout (stub payment integration)

**Acceptance Criteria for Phase 1**:
- ✅ Multi-tenant order creation with isolation enforcement
- ✅ RLS policies prevent cross-tenant data access
- ✅ Admin portal tenant management functional
- ✅ Storefront checkout flow end-to-end
- ✅ 99.5% availability in staging
- ✅ All endpoints documented with OpenAPI/GraphQL schema

**Phase 1 Prerequisites**:
- Infrastructure: K8s cluster, PostgreSQL, Redis
- CI/CD: Docker build & registry, deployment pipelines
- Monitoring: Prometheus + Grafana stubs

---

### 9.2 Phase 2: Event-Driven & Fulfillment (Months 3-4)

**Dependencies on Phase 1**: ✅ (builds on core API & multi-tenancy)

**New Components**:
1. **NATS & Kafka Setup**
   - Event spine for domain events
   - Event schema registry

2. **Fulfillment Service** (Hono/Elysia)
   - Order fulfillment workflows
   - Warehouse & shipping integration
   - Tracking & returns management

3. **Worker Queue Service** (Bull + Redis)
   - Async task processing
   - Email notifications
   - Webhook handlers

4. **Event Consumer Patterns**
   - Order → fulfillment pipeline
   - Inventory allocation

5. **Analytics Foundation** (ClickHouse)
   - Event stream ingestion
   - Basic analytics queries

**New Integrations**:
- Stripe payment processing
- ShipStation shipping API
- SendGrid email service

**Acceptance Criteria for Phase 2**:
- ✅ End-to-end order → pick → ship → deliver flow
- ✅ Events reliably deliver to subscribers (at-least-once)
- ✅ Async jobs process with <5s latency (p99)
- ✅ Fulfillment service scales to 1000 orders/min
- ✅ Analytics queries execute in <1s on 30-day dataset

---

### 9.3 Phase 3: Procurement & Finance (Months 5-6)

**Dependencies on Phase 1-2**: ✅ (uses event spine, async tasks)

**New Components**:
1. **Procurement Service** (extends Core API)
   - PO management
   - Supplier management & integration
   - Goods receipt workflows

2. **Finance Service** (Hono/Elysia)
   - Invoice management
   - Accounting integration
   - Ledger & reconciliation

3. **Supplier Integration Hub**
   - EDI/API connectors
   - PO acknowledgment workflows

**Key Workflows**:
```
PO Creation → Supplier Acknowledge → GR → Invoice → Payment → Reconciliation
```

**Acceptance Criteria for Phase 3**:
- ✅ PO → Invoice flow with automatic reconciliation
- ✅ Supplier API integrations (3+ major suppliers)
- ✅ Accounting GL posting tested with QuickBooks/NetSuite
- ✅ Finance reports (P&L, AR/AP aging) query in <2s

---

### 9.4 Phase 4: Plugin System & Customization (Months 7-8)

**Dependencies on Phase 1-3**: ✅ (extends all services)

**New Components**:
1. **Plugin System Service**
   - Plugin discovery & lifecycle
   - Sandboxed execution
   - Hook registry

2. **Workflow Engine**
   - YAML-based workflow definitions
   - Tenant-specific customization

3. **Feature Flags & Configuration**
   - Dynamic tenant configuration
   - A/B testing framework

**Plugin Types Available**:
- Validators (fraud detection, compliance)
- Transformers (tax calculation, pricing rules)
- Actions (custom fulfillment routing)
- UI Extensions (analytics widgets)
- Integrations (ERP, WMS, custom systems)

**Acceptance Criteria for Phase 4**:
- ✅ Custom validator plugins reduce fraud by 15%
- ✅ Workflow engine handles 99% of tenant use cases
- ✅ Feature flag rollout for 50% of new features
- ✅ Plugin execution overhead <100ms added latency

---

### 9.5 Phase 5: Advanced Analytics & Catalog (Months 9-10)

**Dependencies on Phase 1-4**: ✅

**New Components**:
1. **Catalog Service** (Hono/Elysia)
   - Enhanced product management
   - Multi-variant SKU handling
   - Pricing engine & tiers

2. **Meilisearch Integration**
   - Full-text product search
   - Faceted navigation
   - Real-time indexing

3. **Advanced Analytics**
   - ClickHouse data warehouse
   - Custom BI dashboards
   - Predictive analytics

**Acceptance Criteria for Phase 5**:
- ✅ Search sub-100ms latency (p99)
- ✅ Product catalog scales to 10M+ SKUs
- ✅ Analytics dashboards render in <2s

---

### 9.6 Phase 6: Scale & Hardening (Months 11-12+)

**Focus**: Performance optimization, security hardening, compliance.

**Activities**:
- Database query optimization & sharding strategy
- Cache invalidation patterns
- Security audit & penetration testing
- Compliance certifications (SOC 2, GDPR)
- Disaster recovery & backup testing

---

## 10. Tenant Isolation Deep Dive

### 10.1 Row-Level Security (Primary Strategy)

**Implementation**:

```sql
-- All tables include tenant_id
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  ...
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their tenant's data
CREATE POLICY products_tenant_isolation ON products
  USING (tenant_id = CURRENT_SETTING('app.current_tenant_id')::uuid);

-- Enforce on all operations
CREATE POLICY products_insert ON products
  FOR INSERT WITH CHECK (tenant_id = CURRENT_SETTING('app.current_tenant_id')::uuid);
```

**Setting Tenant Context in Application**:

```typescript
// Connection pool with per-request tenant setting
const pool = new Pool(connectionConfig);

app.use(async (c, next) => {
  const tenantId = extractTenantFromJWT(c);
  const client = await pool.connect();
  
  try {
    // Set session variable for RLS
    await client.query('SET app.current_tenant_id = $1', [tenantId]);
    c.set('db', client);
    await next();
  } finally {
    client.release();
  }
});
```

### 10.2 Schema-Per-Tenant Strategy (Optional, High-Compliance)

For highly regulated tenants requiring complete physical isolation:

```sql
-- Create separate schema per tenant
CREATE SCHEMA tenant_acme_corp;
CREATE SCHEMA tenant_another_brand;

-- All tables created in tenant-specific schema
CREATE TABLE tenant_acme_corp.products (...);
CREATE TABLE tenant_another_brand.products (...);

-- Application switches schema based on tenant
SET search_path TO tenant_acme_corp;
SELECT * FROM products; -- Only acme_corp's data
```

**Trade-offs**:
| Strategy | Isolation | Scalability | Maintenance |
|----------|-----------|-------------|-------------|
| RLS (Shared) | Logical | Excellent | Simple |
| Schema-Per-Tenant | Physical | Good (100-1000 schemas) | Complex |
| Database-Per-Tenant | Physical | Limited | Very Complex |

### 10.3 Tenant-Context Propagation

```
┌─────────────────┐
│  Client Request │
│  Header:        │
│  x-tenant-id: A │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  API Gateway            │
│  • Validate x-tenant-id │
│  • Add to request ctx   │
└────────┬────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Core API Service            │
│  • Extract tenant from JWT   │
│  • Inject into request ctx   │
│  • Pass to data layer        │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│  Data Access Layer           │
│  • Set RLS app.tenant_id     │
│  • Execute queries in context│
└──────────────────────────────┘
```

---

## 11. Security & Compliance

### 11.1 Data Security

```
Encryption In-Transit:
  ├─ TLS 1.3 for all API calls
  ├─ mTLS for inter-service communication
  └─ Encrypted connections to data stores

Encryption At-Rest:
  ├─ PostgreSQL with pgcrypto extension
  ├─ Redis with encryption enabled
  ├─ S3 bucket encryption (for backups)
  └─ Application-level field encryption for PII

Key Management:
  ├─ AWS KMS or HashiCorp Vault for key rotation
  └─ Separate encryption keys per tenant (optional)
```

### 11.2 Audit & Compliance

```sql
-- Audit log table
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  resource_type VARCHAR NOT NULL,
  resource_id UUID NOT NULL,
  action VARCHAR NOT NULL,  -- CREATE, UPDATE, DELETE
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT
);

-- Trigger for automatic audit logging
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (tenant_id, actor_id, resource_type, resource_id, action, old_values, new_values)
  VALUES (
    CURRENT_SETTING('app.current_tenant_id')::uuid,
    CURRENT_SETTING('app.current_user_id')::uuid,
    TG_TABLE_NAME,
    NEW.id,
    TG_OP,
    to_jsonb(OLD),
    to_jsonb(NEW)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER audit_products AFTER INSERT OR UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION audit_trigger();
```

---

## 12. Sequence Diagrams: Core Workflows

### 12.1 Procurement-to-Finance Flow

```
Participant: User, Core API, Procurement Service, Finance Service, ERP System

User->Core API: POST /procurement/orders (PO creation)
Core API->Core API: Validate tenant context
Core API->DB: INSERT procurement_order (tenant_id isolation)
Core API->NATS: Publish po.created event

activate Procurement Service
NATS->Procurement Service: po.created
Procurement Service->Procurement Service: Apply validator plugins
Procurement Service->Integration Hub: Translate to supplier EDI
Integration Hub->ERP System: POST /api/purchase_orders
ERP System->Integration Hub: 201 Created + PO#12345
Integration Hub->NATS: Publish po.acknowledged
deactivate Procurement Service

activate Finance Service
NATS->Finance Service: po.acknowledged
Finance Service->DB: Query PO details (with RLS)
Finance Service->Finance Service: Calculate accrual
Finance Service->DB: INSERT invoice (draft status)
Finance Service->NATS: Publish invoice.created
deactivate Finance Service

activate Worker Service
NATS->Worker Service: invoice.created
Worker Service->Worker Service: Schedule reminder (3 days before due)
deactivate Worker Service

Note over User: Supplier ships goods...

activate Procurement Service
Procurement Service->Integration Hub: Poll/webhook for GR
Integration Hub->Procurement Service: goods_received event
Procurement Service->DB: UPDATE procurement_order (received_qty, date)
Procurement Service->NATS: Publish po.partially_received
deactivate Procurement Service

activate Finance Service
NATS->Finance Service: po.partially_received
Finance Service->DB: Query invoice, PO, received qty
Finance Service->Finance Service: Finalize invoice (received qty match)
Finance Service->DB: UPDATE invoice (status=ready_to_pay)
Finance Service->NATS: Publish invoice.finalized
Finance Service->ERP System: POST /api/invoices (via Integration Hub)
deactivate Finance Service

activate Finance Service
Finance Service->DB: INSERT payment record
Finance Service->NATS: Publish payment.recorded
deactivate Finance Service

Note over User,ERP System: Payment confirmation received → accounting GL updated
```

### 12.2 Order Fulfillment Flow

```
Participant: Buyer, Storefront, Core API, Fulfillment Service, WMS, Carrier

Buyer->Storefront: Add to cart + Checkout
Storefront->Core API: POST /orders with cart items
Core API->Core API: Validate tenant context
Core API->DB: INSERT order, order_items (tenant isolation via RLS)
Core API->NATS: Publish order.created

activate Fulfillment Service
NATS->Fulfillment Service: order.created
Fulfillment Service->Fulfillment Service: Run validator plugins
Fulfillment Service->Core API: GET /inventory/allocate (check stock)
Core API->DB: UPDATE inventory (allocated = allocated + qty)
Core API->NATS: Publish inventory.allocated
Fulfillment Service->DB: INSERT picking_task
Fulfillment Service->NATS: Publish picking_task.assigned
deactivate Fulfillment Service

activate WMS
NATS->WMS: picking_task.assigned
WMS->WMS: Receive & queue task
WMS->WMS: Picker scans & picks items
WMS->WMS: QC verification
WMS->Core API: PATCH /orders/{id}/confirm_picked
deactivate WMS

activate Fulfillment Service
Core API->NATS: Publish order.ready_to_ship
NATS->Fulfillment Service: order.ready_to_ship
Fulfillment Service->Carrier: POST /shipments (FedEx, UPS API)
Carrier->Fulfillment Service: 201 Created + tracking#
Fulfillment Service->DB: INSERT shipment record
Fulfillment Service->NATS: Publish shipment.created
Fulfillment Service->Buyer: Send email with tracking
deactivate Fulfillment Service

activate Buyer
Buyer->Storefront: Track order (GET /orders/{id}/tracking)
Storefront->Core API: GET /tracking
Core API->DB: Fetch tracking info (tenant filtered)
Core API->Storefront: Tracking details + status
deactivate Buyer
```

---

## 13. High-Level Interaction Diagrams

### 13.1 Multi-Tenant Data Flow

```
        ┌─────────────┐
        │   Client A  │
        │ (Brand ABC) │
        └──────┬──────┘
               │
       ┌───────▼────────┐
       │ API Gateway    │
       │ Route & Auth   │
       └───────┬────────┘
               │
        ┌──────▼────────┐
        │  Core API     │
        │ (Single image)│
        │ tenant_id=ABC │
        └───────┬────────┘
                │
         ┌──────▼──────────────────────┐
         │    PostgreSQL RLS Filter    │
         │  WHERE tenant_id = ABC      │
         └──────┬──────────────────────┘
                │
        ┌───────▼───────┐
        │ Client A Data │
        │   (Isolated)  │
        └───────────────┘


        ┌─────────────┐
        │   Client B  │
        │ (Brand XYZ) │
        └──────┬──────┘
               │
       ┌───────▼────────┐
       │ API Gateway    │
       │ Route & Auth   │
       └───────┬────────┘
               │
        ┌──────▼────────┐
        │  Core API     │
        │ (Same image)  │
        │ tenant_id=XYZ │
        └───────┬────────┘
                │
         ┌──────▼──────────────────────┐
         │    PostgreSQL RLS Filter    │
         │  WHERE tenant_id = XYZ      │
         └──────┬──────────────────────┘
                │
        ┌───────▼───────┐
        │ Client B Data │
        │   (Isolated)  │
        └───────────────┘
```

### 13.2 Service Communication Patterns

```
Synchronous (Request/Reply):
┌─────────────┐
│  Service A  │
└──────┬──────┘
       │ HTTP/gRPC (Hono)
       ▼
┌──────────────────┐
│  Service B       │
│  (Hono/Elysia)   │
└──────┬───────────┘
       │ Response
       ▼
┌─────────────┐
│  Service A  │
└─────────────┘


Event-Driven (Async):
┌─────────────┐
│  Service A  │
└──────┬──────┘
       │ Publish Event (NATS/Kafka)
       ▼
┌──────────────────────────┐
│  Event Bus (NATS/Kafka)  │
└──────┬─────────┬─────────┘
       │         │
       ▼         ▼
┌─────────┐  ┌─────────┐
│Service B│  │Service C│
│Consumes │  │Consumes │
│ Event   │  │ Event   │
└─────────┘  └─────────┘
```

---

## 14. Summary & Next Steps

### 14.1 Architecture Highlights

✅ **Multi-tenant by design**: RLS-enforced isolation with optional schema-per-tenant
✅ **Event-driven core**: NATS for commands, Kafka for durable events
✅ **Composable services**: Hono/Elysia APIs on Bun.js for performance
✅ **Configuration-driven**: Workflows, feature flags, UI schemas defined as data
✅ **Observable**: OpenTelemetry, structured logging, metrics from start
✅ **Secure**: Encryption, audit trails, tenant context propagation
✅ **Scalable**: Stateless services, horizontal scaling, database replication

### 14.2 Phase 1 Blockers & Prerequisites

**Infrastructure Requirements**:
1. Kubernetes cluster with container orchestration
2. PostgreSQL 13+ with replication support
3. Redis Cluster for sessions & cache
4. Service mesh (optional, Istio/Linkerd for observability)
5. Container registry for Docker images
6. CI/CD pipeline (GitHub Actions, GitLab CI, or Tekton)

**Development Requirements**:
1. Bun.js runtime (v0.7+)
2. TypeScript 5.0+
3. Hono/Elysia web framework
4. ORM: Prisma or TypeORM for PostgreSQL
5. Testing: Vitest + Playwright for E2E

**Data Model Requirements**:
1. Core entity schema (products, orders, tenants, users)
2. RLS policy templates (copy-paste to new services)
3. Audit logging infrastructure
4. Migration tooling (Flyway or Liquibase)

**Operational Requirements**:
1. Monitoring stack (Prometheus + Grafana)
2. Logging infrastructure (ELK or similar)
3. Backup & DR procedures
4. Incident response playbooks

### 14.3 Acceptance Criteria (This Document)

✅ All core components documented (services, data stores, plugins, dashboards)
✅ Service relationships shown in ASCII diagrams
✅ Sequence flows for procurement→finance and order fulfillment provided
✅ Tenant isolation strategy detailed (RLS + optional schema)
✅ Plugin system architecture with hook points defined
✅ Configuration-driven customization patterns documented
✅ Phase 1 prerequisites explicitly mapped:
   - Multi-tenant auth + RLS foundation
   - Basic CRUD services (Core API, Admin, Storefront)
   - PostgreSQL + Redis operational
   - Admin portal for tenant management
✅ Downstream phase dependencies identified (Phases 2-6)
✅ High availability & observability layers described
✅ Security & compliance considerations included

---

## Appendix A: Technology Stack Summary

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Bun.js | Performance, TypeScript native, Edge compute ready |
| Web Framework | Hono/Elysia | Lightweight, Bun-optimized, excellent routing |
| Admin UI | Next.js | SSR, rich UI components, SEO benefits |
| Storefront | Next.js / Remix / Vue | Flexible, headless-ready, CDN-friendly |
| Primary DB | PostgreSQL 13+ | ACID, RLS support, JSON, trusted choice |
| Session Store | Redis Cluster | Performance, pub/sub, Bull integration |
| Event Bus | NATS + Kafka | Complementary: NATS for speed, Kafka for durability |
| Search | Meilisearch | Fast full-text, faceting, typo tolerance |
| Analytics DB | ClickHouse | Columnar, real-time aggregations, efficient storage |
| Orchestration | Kubernetes | Multi-region, self-healing, standard DevOps |
| Monitoring | Prometheus + Grafana + Jaeger | Open-source, observable, integrated alerting |
| Container Registry | Docker Hub / ECR / Harbor | Artifact management, scanning, replication |
| Message Queue | Bull (Redis) | Simple, Redis-backed, retry logic |

---

## Appendix B: Configuration Examples

### B.1 Tenant Configuration Object

```json
{
  "tenant": {
    "id": "tenant_acme_corp_001",
    "name": "ACME Corporation",
    "tier": "enterprise",
    "subscription": {
      "start_date": "2024-01-01",
      "end_date": "2025-01-01",
      "status": "active",
      "features": [
        "advanced_analytics",
        "custom_plugins",
        "priority_support",
        "api_access"
      ]
    },
    "settings": {
      "currency": "USD",
      "timezone": "America/New_York",
      "language": "en-US",
      "tax_id": "12-3456789",
      "fiscal_year_start": "2024-01-01"
    },
    "integrations": {
      "erp": {
        "type": "netsuite",
        "connection_id": "netsuite_acme_001",
        "sync_schedule": "*/15 * * * *",
        "enabled": true
      },
      "payment_gateway": {
        "type": "stripe",
        "account_id": "acct_1234567890",
        "enabled": true
      },
      "warehouse": {
        "type": "manhattan",
        "api_endpoint": "https://api.manhattan.example.com",
        "enabled": true
      }
    },
    "plugins": [
      {
        "id": "fraud-detector-premium",
        "enabled": true,
        "config": {
          "risk_threshold": 0.8
        }
      },
      {
        "id": "inventory-optimizer",
        "enabled": true,
        "config": {
          "ml_model": "linear-regression-v2",
          "forecast_days": 30
        }
      }
    ]
  }
}
```

### B.2 Event Schema Example (Kafka)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "OrderCreatedEvent",
  "type": "object",
  "properties": {
    "event_id": { "type": "string", "format": "uuid" },
    "event_type": { "type": "string", "const": "order.created" },
    "tenant_id": { "type": "string", "format": "uuid" },
    "timestamp": { "type": "string", "format": "date-time" },
    "version": { "type": "integer", "const": 1 },
    "data": {
      "order_id": { "type": "string", "format": "uuid" },
      "customer_id": { "type": "string", "format": "uuid" },
      "order_date": { "type": "string", "format": "date-time" },
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "sku": { "type": "string" },
            "quantity": { "type": "integer", "minimum": 1 },
            "unit_price": { "type": "number" }
          }
        }
      },
      "total_amount": { "type": "number" },
      "shipping_address": { "type": "object" },
      "metadata": { "type": "object" }
    }
  }
}
```

---

## Appendix C: Deployment Checklist (Phase 1)

```
Pre-Deployment:
  ☐ All services pass security scan
  ☐ RLS policies tested for isolation
  ☐ Database backups automated
  ☐ Monitoring stack collecting metrics
  ☐ Logging centralized & searchable
  ☐ Load testing completed (target: 500 req/s)

Deployment:
  ☐ Blue-green deployment set up
  ☐ Canary rollout (10% → 50% → 100%)
  ☐ Health checks passing on all instances
  ☐ Smoke tests successful
  ☐ Data replication lag <100ms
  ☐ Cache warm-up completed

Post-Deployment:
  ☐ Performance metrics baseline captured
  ☐ Error rate monitored (<0.5%)
  ☐ Tenant isolation verified (cross-tenant access blocked)
  ☐ Incident response team on standby
  ☐ Customer communication sent
```

---

**Document Version**: 1.0
**Last Updated**: 2024
**Architecture Review Cycle**: Quarterly
