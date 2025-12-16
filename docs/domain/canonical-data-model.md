# Canonical Data Model - Unified Commerce OS

## Executive Summary

This document defines the unified entity hierarchy and data structures for the Unified Commerce OS platform. It establishes the canonical data model across all domains (Procurement, Inventory, Product, Pricing, Orders, Finance, Analytics, and AI Telemetry) with clear attributes, relationships, Row-Level Security (RLS) keys, and ClickHouse materialized views for analytics.

The model is designed for **multi-tenancy** with tenant isolation at both the logical (RLS) and physical (schema) levels.

---

## 1. Entity Hierarchy & Organizational Structure

### 1.1 Core Organizational Model: Org → Brand → Location

```
┌─────────────────────────────────────────────────────────┐
│                      Organization                       │
│  (tenant root - billing, legal entity)                  │
├─────────────────────────────────────────────────────────┤
│  • tenant_id (UUID) - Multi-tenancy identifier          │
│  • name, legal_name, registration_id                    │
│  • primary_currency, tax_jurisdiction                   │
│                                                          │
│  └──────────────────────────────────────────────────────┘
│          │
│          ├─► Brand 1 (Consumer brand identity)
│          │   ├─► Location: Warehouse NYC
│          │   ├─► Location: Warehouse LA
│          │   └─► Location: HQ Chicago
│          │
│          ├─► Brand 2 (B2B enterprise)
│          │   ├─► Location: Manufacturing Delhi
│          │   └─► Location: Distribution Bangkok
│          │
│          └─► Brand N
│              └─► Location: Fulfillment Center
└─────────────────────────────────────────────────────────┘
```

### 1.2 Entity Relationship Diagram (ERD) - Core Structure

```
┌──────────────────────┐         ┌──────────────────────┐
│      tenants         │◄───────►│      brands          │
├──────────────────────┤         ├──────────────────────┤
│ tenant_id (PK)       │         │ brand_id (PK)        │
│ name                 │         │ tenant_id (FK) [RLS] │
│ subscription_tier    │         │ name                 │
│ settings (JSONB)     │         │ color, logo_url      │
└──────────────────────┘         └──┬───────────────────┘
                                    │
                                    │ 1:N
                                    ▼
                        ┌──────────────────────┐
                        │     locations        │
                        ├──────────────────────┤
                        │ location_id (PK)     │
                        │ brand_id (FK) [RLS]  │
                        │ tenant_id (FK) [RLS] │
                        │ name, type, address  │
                        │ warehouse_id (FK)    │
                        └──────────────────────┘
```

---

## 2. Procurement Domain

### 2.1 Procurement Order Model

**Table: `procurement_orders`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| po_id | UUID | PRIMARY KEY | - | Unique procurement order identifier |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| brand_id | UUID | NOT NULL, FK(brands) | - | Brand requesting procurement |
| supplier_id | UUID | NOT NULL, FK(suppliers) | - | Supplier providing goods |
| po_number | VARCHAR(100) | UNIQUE(tenant_id, po_number) | - | Human-readable PO number |
| order_date | TIMESTAMP | DEFAULT NOW() | - | When PO was created |
| delivery_date | TIMESTAMP | - | - | Expected delivery date |
| total_amount_cents | BIGINT | NOT NULL | - | Total in cents |
| currency | VARCHAR(3) | DEFAULT 'USD' | - | Currency code (ISO 4217) |
| status | VARCHAR(50) | DEFAULT 'draft' | - | draft, submitted, acknowledged, received, invoiced, closed, cancelled |
| payment_terms | VARCHAR(100) | - | - | e.g., "net_30", "cod" |
| notes | TEXT | - | - | Internal notes |
| metadata | JSONB | DEFAULT '{}' | - | Extensible fields (tax_id, reference_number) |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Record creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | - | Last update timestamp |

**Cross-Reference**: Related events: `po.created`, `po.acknowledged`, `po.partially_received`, `po.completed` (see [Event Catalog](./event-catalog.md#procurement-events))

### 2.2 Procurement Order Items

**Table: `procurement_order_items`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| po_item_id | UUID | PRIMARY KEY | - | Unique line item identifier |
| po_id | UUID | NOT NULL, FK(procurement_orders) | - | Reference to parent PO |
| product_id | UUID | NOT NULL, FK(products) | - | Product being procured |
| quantity | BIGINT | NOT NULL | - | Ordered quantity |
| unit_price_cents | BIGINT | NOT NULL | - | Price per unit in cents |
| received_quantity | BIGINT | DEFAULT 0 | - | Quantity received so far |
| sku | VARCHAR(100) | - | - | Product SKU (denormalized for audit) |
| metadata | JSONB | DEFAULT '{}' | - | Item-level metadata |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Record creation |

### 2.3 Supplier Master Data

**Table: `suppliers`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| supplier_id | UUID | PRIMARY KEY | - | Unique supplier identifier |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| name | VARCHAR(255) | NOT NULL | - | Supplier legal name |
| contact_email | VARCHAR(255) | - | - | Primary contact email |
| api_key | VARCHAR(255) | - | - | Integration API key (encrypted) |
| payment_account | JSONB | - | - | Bank details, payment processor config |
| rating | DECIMAL(3,2) | DEFAULT 5.0 | - | Supplier quality rating (0-5) |
| metadata | JSONB | DEFAULT '{}' | - | Additional supplier data |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Record creation |

---

## 3. Inventory Domain

### 3.1 Stock Ledger (Inventory Movement Tracking)

**Table: `inventory_stock_ledger`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| ledger_id | UUID | PRIMARY KEY | - | Unique ledger entry ID |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| product_id | UUID | NOT NULL, FK(products) | - | Product being tracked |
| location_id | UUID | NOT NULL, FK(locations) | - | Warehouse/location |
| movement_type | VARCHAR(50) | NOT NULL | - | allocated, reserved, released, received, adjusted, sold, returned, damaged, lost |
| quantity | BIGINT | NOT NULL | - | Quantity change (positive or negative) |
| reference_id | UUID | - | - | Related order/PO ID |
| reference_type | VARCHAR(50) | - | - | order_id, po_id, adjustment_id |
| reason | VARCHAR(255) | - | - | Human-readable reason |
| created_at | TIMESTAMP | DEFAULT NOW(), INDEX | - | Movement timestamp (indexed for range queries) |
| updated_at | TIMESTAMP | DEFAULT NOW() | - | Last update |
| metadata | JSONB | DEFAULT '{}' | - | Additional context |

### 3.2 Current Stock View (Materialized Snapshot)

**Table: `inventory_current_stock`** (materialized/cached)

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| stock_id | UUID | PRIMARY KEY | - | Unique stock record |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| product_id | UUID | NOT NULL, FK(products) | - | Product ID |
| location_id | UUID | NOT NULL, FK(locations) | - | Warehouse location |
| on_hand_quantity | BIGINT | DEFAULT 0 | - | Physically available stock |
| allocated_quantity | BIGINT | DEFAULT 0 | - | Reserved for orders (cannot sell) |
| reserved_quantity | BIGINT | DEFAULT 0 | - | Reserved with expiry (short-term hold) |
| available_quantity | BIGINT | GENERATED AS (on_hand_quantity - allocated_quantity - reserved_quantity) | - | Net available for sale |
| reorder_point | BIGINT | - | - | Minimum before reorder |
| reorder_quantity | BIGINT | - | - | Standard reorder amount |
| last_received_date | TIMESTAMP | - | - | Last goods receipt timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | - | Last cache refresh |

---

## 4. Product & Catalog Domain

### 4.1 Product Master

**Table: `products`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| product_id | UUID | PRIMARY KEY | - | Unique product identifier |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| brand_id | UUID | NOT NULL, FK(brands) | - | Brand owning product |
| sku | VARCHAR(100) | UNIQUE(tenant_id, sku) | - | Stock-keeping unit |
| name | VARCHAR(255) | NOT NULL | - | Product display name |
| description | TEXT | - | - | Product description |
| category_id | UUID | FK(categories) | - | Product category |
| image_urls | JSONB | - | - | Array of image URLs |
| attributes | JSONB | - | - | Dynamic attributes (color, size, material) |
| status | VARCHAR(50) | DEFAULT 'active' | - | active, inactive, discontinued |
| metadata | JSONB | DEFAULT '{}' | - | Custom fields (supplier_sku, internal_code) |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | - | Last update timestamp |

**Cross-Reference**: Related events: `product.created`, `product.updated`, `product.deleted` (see [Event Catalog](./event-catalog.md#catalog-events))

### 4.2 Product Variants

**Table: `product_variants`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| variant_id | UUID | PRIMARY KEY | - | Unique variant identifier |
| product_id | UUID | NOT NULL, FK(products) | - | Parent product |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| sku | VARCHAR(100) | UNIQUE(tenant_id, sku) | - | Variant-specific SKU |
| attributes | JSONB | NOT NULL | - | Variant-specific attributes (size: "M", color: "red") |
| images | JSONB | - | - | Variant-specific images |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

### 4.3 Product Categories

**Table: `categories`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| category_id | UUID | PRIMARY KEY | - | Unique category ID |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| brand_id | UUID | NOT NULL, FK(brands) | - | Brand category belongs to |
| name | VARCHAR(255) | NOT NULL | - | Category name |
| parent_category_id | UUID | FK(categories) | - | For hierarchical categories |
| description | TEXT | - | - | Category description |
| display_order | INT | - | - | Sort order in UI |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

---

## 5. Pricing Domain

### 5.1 Price List

**Table: `price_lists`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| price_list_id | UUID | PRIMARY KEY | - | Unique price list identifier |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| brand_id | UUID | NOT NULL, FK(brands) | - | Brand this price list applies to |
| name | VARCHAR(255) | NOT NULL | - | Price list name (e.g., "Wholesale Q1 2024") |
| currency | VARCHAR(3) | DEFAULT 'USD' | - | Currency code (ISO 4217) |
| effective_date | DATE | DEFAULT CURRENT_DATE | - | When price list becomes active |
| expiration_date | DATE | - | - | When price list expires (NULL = indefinite) |
| status | VARCHAR(50) | DEFAULT 'draft' | - | draft, active, archived |
| rules | JSONB | - | - | Pricing rules (tiering, discounts, conditions) |
| metadata | JSONB | DEFAULT '{}' | - | Additional data |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

**Cross-Reference**: Related events: `price_list.created`, `price_list.activated`, `price_list.archived` (see [Event Catalog](./event-catalog.md#pricing-events))

### 5.2 Product Pricing

**Table: `product_prices`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| price_id | UUID | PRIMARY KEY | - | Unique price record |
| product_id | UUID | NOT NULL, FK(products) | - | Product being priced |
| price_list_id | UUID | NOT NULL, FK(price_lists) | - | Associated price list |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| base_price_cents | BIGINT | NOT NULL | - | Base price in cents |
| currency | VARCHAR(3) | NOT NULL | - | Currency code |
| tiered_pricing | JSONB | - | - | Array: [{min_qty, max_qty, price_cents}] |
| cost_price_cents | BIGINT | - | - | Cost for margin calculation |
| margin_percent | DECIMAL(5,2) | GENERATED | - | ((base_price - cost) / cost) * 100 |
| effective_date | DATE | DEFAULT CURRENT_DATE | - | Price effective date |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

### 5.3 Promotions & Discounts

**Table: `promotions`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| promotion_id | UUID | PRIMARY KEY | - | Unique promotion identifier |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| brand_id | UUID | NOT NULL, FK(brands) | - | Brand promotion applies to |
| name | VARCHAR(255) | NOT NULL | - | Promotion name |
| discount_type | VARCHAR(50) | - | - | percentage, fixed_amount, buy_x_get_y |
| discount_value | DECIMAL(10,2) | NOT NULL | - | Discount value (amount or percentage) |
| max_uses | INT | - | - | Maximum times promotion can be used |
| current_uses | INT | DEFAULT 0 | - | Current usage count |
| start_date | TIMESTAMP | NOT NULL | - | When promotion starts |
| end_date | TIMESTAMP | - | - | When promotion ends |
| conditions | JSONB | - | - | Purchase conditions (min_amount, product_ids, categories) |
| status | VARCHAR(50) | DEFAULT 'draft' | - | draft, active, paused, completed, cancelled |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

---

## 6. Orders Domain

### 6.1 Sales Order

**Table: `orders`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| order_id | UUID | PRIMARY KEY | - | Unique order identifier |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| brand_id | UUID | NOT NULL, FK(brands) | - | Brand order belongs to |
| order_number | VARCHAR(100) | UNIQUE(tenant_id, order_number) | - | Human-readable order number |
| customer_id | UUID | NOT NULL, FK(customers) | - | Customer placing order |
| status | VARCHAR(50) | DEFAULT 'pending' | - | pending, confirmed, picking, shipped, delivered, cancelled, returned |
| order_date | TIMESTAMP | DEFAULT NOW() | - | When order was placed |
| shipping_address_id | UUID | FK(addresses) | - | Shipping address |
| billing_address_id | UUID | FK(addresses) | - | Billing address |
| subtotal_cents | BIGINT | NOT NULL | - | Line items total (before tax/shipping) |
| tax_cents | BIGINT | DEFAULT 0 | - | Calculated tax amount |
| shipping_cost_cents | BIGINT | DEFAULT 0 | - | Shipping cost |
| discount_cents | BIGINT | DEFAULT 0 | - | Applied discount |
| total_cents | BIGINT | NOT NULL | - | Final total |
| currency | VARCHAR(3) | DEFAULT 'USD' | - | Currency code |
| payment_method | VARCHAR(50) | - | - | credit_card, bank_transfer, invoice |
| shipping_method | VARCHAR(50) | - | - | standard, express, overnight |
| notes | TEXT | - | - | Order notes/special instructions |
| metadata | JSONB | DEFAULT '{}' | - | Custom fields |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | - | Last update timestamp |

**Cross-Reference**: Related events: `order.created`, `order.confirmed`, `order.shipped`, `order.delivered`, `order.cancelled` (see [Event Catalog](./event-catalog.md#order-events))

### 6.2 Order Items

**Table: `order_items`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| order_item_id | UUID | PRIMARY KEY | - | Unique line item ID |
| order_id | UUID | NOT NULL, FK(orders) | - | Parent order |
| product_id | UUID | NOT NULL, FK(products) | - | Product ordered |
| variant_id | UUID | FK(product_variants) | - | Product variant (if applicable) |
| quantity | BIGINT | NOT NULL | - | Quantity ordered |
| unit_price_cents | BIGINT | NOT NULL | - | Price per unit at time of order |
| discount_cents | BIGINT | DEFAULT 0 | - | Line-item discount |
| tax_cents | BIGINT | DEFAULT 0 | - | Line-item tax |
| total_cents | BIGINT | NOT NULL | - | Line total |
| sku | VARCHAR(100) | - | - | Product SKU (denormalized) |
| metadata | JSONB | DEFAULT '{}' | - | Custom fields |

### 6.3 Shipments

**Table: `shipments`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| shipment_id | UUID | PRIMARY KEY | - | Unique shipment identifier |
| order_id | UUID | NOT NULL, FK(orders) | - | Associated order |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| tracking_number | VARCHAR(100) | - | - | Carrier tracking number |
| carrier | VARCHAR(50) | - | - | Shipping carrier (fedex, ups, usps) |
| shipped_date | TIMESTAMP | - | - | When shipment left warehouse |
| delivered_date | TIMESTAMP | - | - | When shipment was delivered |
| status | VARCHAR(50) | DEFAULT 'pending' | - | pending, shipped, in_transit, delivered, failed |
| metadata | JSONB | DEFAULT '{}' | - | Carrier-specific data |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

---

## 7. Finance Domain

### 7.1 Invoices

**Table: `invoices`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| invoice_id | UUID | PRIMARY KEY | - | Unique invoice identifier |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| brand_id | UUID | NOT NULL, FK(brands) | - | Brand issuing invoice |
| invoice_number | VARCHAR(100) | UNIQUE(tenant_id, invoice_number) | - | Invoice number |
| invoice_type | VARCHAR(50) | - | - | sales, procurement, credit_memo, debit_memo |
| order_id | UUID | FK(orders) | - | Related sales order (if applicable) |
| po_id | UUID | FK(procurement_orders) | - | Related procurement order (if applicable) |
| customer_id | UUID | FK(customers) | - | Customer (for sales invoices) |
| supplier_id | UUID | FK(suppliers) | - | Supplier (for procurement invoices) |
| issue_date | DATE | DEFAULT CURRENT_DATE | - | Invoice issue date |
| due_date | DATE | NOT NULL | - | Payment due date |
| subtotal_cents | BIGINT | NOT NULL | - | Subtotal before tax/shipping |
| tax_cents | BIGINT | DEFAULT 0 | - | Tax amount |
| shipping_cents | BIGINT | DEFAULT 0 | - | Shipping/delivery charges |
| total_cents | BIGINT | NOT NULL | - | Total amount due |
| paid_cents | BIGINT | DEFAULT 0 | - | Amount paid so far |
| status | VARCHAR(50) | DEFAULT 'draft' | - | draft, issued, sent, partial, paid, overdue, cancelled |
| payment_terms | VARCHAR(100) | - | - | e.g., net_30, due_on_receipt |
| notes | TEXT | - | - | Invoice notes |
| metadata | JSONB | DEFAULT '{}' | - | Custom fields |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

**Cross-Reference**: Related events: `invoice.created`, `invoice.issued`, `payment.received`, `payment.failed`, `invoice.overdue` (see [Event Catalog](./event-catalog.md#finance-events))

### 7.2 Payments & Transactions

**Table: `payments`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| payment_id | UUID | PRIMARY KEY | - | Unique payment identifier |
| invoice_id | UUID | NOT NULL, FK(invoices) | - | Associated invoice |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| amount_cents | BIGINT | NOT NULL | - | Payment amount in cents |
| payment_method | VARCHAR(50) | NOT NULL | - | credit_card, bank_transfer, cash, check, digital_wallet |
| payment_processor | VARCHAR(50) | - | - | stripe, paypal, square, manual |
| transaction_id | VARCHAR(255) | - | - | External payment processor transaction ID |
| status | VARCHAR(50) | DEFAULT 'pending' | - | pending, completed, failed, cancelled, refunded |
| paid_at | TIMESTAMP | - | - | When payment was processed |
| metadata | JSONB | DEFAULT '{}' | - | Processor-specific data |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

### 7.3 General Ledger Accounts

**Table: `gl_accounts`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| account_id | UUID | PRIMARY KEY | - | Unique GL account ID |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| account_number | VARCHAR(20) | UNIQUE(tenant_id, account_number) | - | GL account number |
| account_name | VARCHAR(255) | NOT NULL | - | Account name |
| account_type | VARCHAR(50) | NOT NULL | - | asset, liability, equity, revenue, expense |
| description | TEXT | - | - | Account description |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

### 7.4 Journal Entries (Accounting Records)

**Table: `journal_entries`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| entry_id | UUID | PRIMARY KEY | - | Unique journal entry ID |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| entry_date | DATE | NOT NULL | - | Entry date |
| reference_type | VARCHAR(50) | - | - | invoice, payment, adjustment, transfer |
| reference_id | UUID | - | - | Reference document ID |
| account_id | UUID | NOT NULL, FK(gl_accounts) | - | GL account |
| debit_cents | BIGINT | DEFAULT 0 | - | Debit amount in cents |
| credit_cents | BIGINT | DEFAULT 0 | - | Credit amount in cents |
| description | TEXT | - | - | Entry description |
| posted | BOOLEAN | DEFAULT FALSE | - | Whether entry has been posted |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

---

## 8. Analytics Domain

### 8.1 Event Stream (ClickHouse)

**ClickHouse Table: `events`** (materialized view or native table)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| timestamp | DateTime | PRIMARY, PARTITION | Event occurrence time (partitioned by month) |
| tenant_id | UUID | - | Multi-tenant identifier for filtering |
| brand_id | UUID | - | Brand context |
| event_type | String | - | Event name (e.g., "order.created", "payment.received") |
| entity_type | String | - | Entity being acted upon (order, invoice, product) |
| entity_id | UUID | - | ID of entity |
| actor_id | UUID | - | User/system that triggered event |
| actor_type | String | - | user, system, integration |
| payload | String (JSON) | - | Event payload (serialized) |
| idempotency_key | String | UNIQUE KEY | Idempotency key for deduplication |
| source | String | - | Service that published event (core_api, catalog_service) |
| metadata | String (JSON) | - | Additional metadata |

**Materialized Views for Analytics**:

```sql
-- Sales performance by day
CREATE MATERIALIZED VIEW events_orders_daily AS
SELECT 
  toDate(timestamp) as date,
  tenant_id,
  brand_id,
  count(DISTINCT entity_id) as order_count,
  sum(JSONExtractFloat(payload, '$.total_cents')) / 100 as revenue
FROM events
WHERE event_type IN ('order.created', 'order.completed')
GROUP BY date, tenant_id, brand_id;

-- Inventory movements by product
CREATE MATERIALIZED VIEW events_inventory_movements AS
SELECT 
  tenant_id,
  JSONExtractString(payload, '$.product_id') as product_id,
  event_type,
  count(*) as movement_count,
  sum(JSONExtractInt(payload, '$.quantity')) as total_quantity
FROM events
WHERE event_type LIKE 'inventory.%'
GROUP BY tenant_id, product_id, event_type;

-- Payment success rate
CREATE MATERIALIZED VIEW events_payment_metrics AS
SELECT 
  toDate(timestamp) as date,
  tenant_id,
  event_type,
  count(*) as event_count,
  uniq(JSONExtractString(payload, '$.invoice_id')) as unique_invoices
FROM events
WHERE event_type IN ('payment.received', 'payment.failed')
GROUP BY date, tenant_id, event_type;
```

### 8.2 Metrics Aggregation

**Table: `analytics_metrics`** (time-series aggregates)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| metric_id | UUID | PRIMARY KEY | Unique metric record |
| tenant_id | UUID | NOT NULL | Multi-tenant identifier |
| metric_name | VARCHAR(255) | NOT NULL | e.g., "orders_per_day", "avg_order_value" |
| metric_value | DECIMAL(15,2) | NOT NULL | Computed value |
| dimension_1 | VARCHAR(100) | - | First dimension (e.g., brand_id) |
| dimension_2 | VARCHAR(100) | - | Second dimension (e.g., location_id) |
| timestamp | TIMESTAMP | NOT NULL, INDEX | Aggregation timestamp |
| created_at | TIMESTAMP | DEFAULT NOW() | Record creation |

---

## 9. AI Telemetry Domain

### 9.1 AI Training Events

**Table: `ai_telemetry_training`** (analytics-focused)

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| training_event_id | UUID | PRIMARY KEY | - | Unique training event |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| model_type | VARCHAR(100) | - | - | demand_forecast, price_optimizer, churn_prediction |
| input_data_summary | JSONB | - | - | { features: [...], sample_count, date_range } |
| training_start | TIMESTAMP | NOT NULL | - | When training started |
| training_end | TIMESTAMP | - | - | When training completed |
| accuracy_score | DECIMAL(5,4) | - | - | Model accuracy metric (0-1) |
| precision_score | DECIMAL(5,4) | - | - | Precision metric |
| recall_score | DECIMAL(5,4) | - | - | Recall metric |
| f1_score | DECIMAL(5,4) | - | - | F1 score |
| hyperparameters | JSONB | - | - | Model hyperparameters used |
| metadata | JSONB | DEFAULT '{}' | - | Additional metadata |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Record creation |

**Cross-Reference**: Related events: `model.training_started`, `model.training_completed`, `model.accuracy_updated` (see [Event Catalog](./event-catalog.md#ai-telemetry-events))

### 9.2 AI Inference Logs

**Table: `ai_telemetry_inferences`** (ClickHouse - high-volume append-only)

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| timestamp | DateTime | PARTITION | When inference was performed |
| tenant_id | UUID | - | Multi-tenant identifier |
| model_type | String | - | Model that performed inference |
| input_entity_id | UUID | - | Entity ID (product, customer, order) |
| input_entity_type | String | - | Entity type being predicted for |
| prediction_output | String (JSON) | - | Model output/prediction |
| confidence_score | Float32 | - | Confidence of prediction (0-1) |
| actual_outcome | String (JSON) | - | Actual result (populated later for validation) |
| inference_latency_ms | Float32 | - | Inference time in milliseconds |
| source | String | - | Service that requested inference |

### 9.3 AI Model Registry

**Table: `ai_models`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| model_id | UUID | PRIMARY KEY | - | Unique model identifier |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| model_name | VARCHAR(255) | NOT NULL | - | Model name |
| model_type | VARCHAR(100) | NOT NULL | - | demand_forecast, price_optimizer, etc. |
| version | VARCHAR(50) | NOT NULL | - | Model version (semver) |
| status | VARCHAR(50) | DEFAULT 'draft' | - | draft, training, staging, production, archived |
| artifact_uri | VARCHAR(255) | - | - | S3 or artifact store URI |
| training_event_id | UUID | FK(ai_telemetry_training) | - | Associated training event |
| deployed_at | TIMESTAMP | - | - | When deployed to production |
| accuracy_baseline | DECIMAL(5,4) | - | - | Expected minimum accuracy |
| metadata | JSONB | DEFAULT '{}' | - | Model metadata |
| created_at | TIMESTAMP | DEFAULT NOW() | - | Creation timestamp |

---

## 10. Audit & Compliance

### 10.1 Audit Log

**Table: `audit_logs`**

| Column | Type | Constraints | RLS Key | Description |
|--------|------|-------------|---------|-------------|
| audit_id | UUID | PRIMARY KEY | - | Unique audit record |
| tenant_id | UUID | NOT NULL, FK(tenants) | **✓ RLS** | Multi-tenant identifier |
| actor_id | UUID | NOT NULL, FK(users) | - | User performing action |
| actor_type | VARCHAR(50) | - | - | user, service, integration |
| action | VARCHAR(100) | NOT NULL | - | create, update, delete, export, download |
| entity_type | VARCHAR(100) | NOT NULL | - | Type of entity modified (order, invoice, product) |
| entity_id | UUID | NOT NULL | - | ID of entity modified |
| old_values | JSONB | - | - | Previous state (for updates) |
| new_values | JSONB | - | - | New state |
| changes | JSONB | - | - | Delta of changes |
| reason | TEXT | - | - | Why action was taken |
| ip_address | INET | - | - | IP address of requester |
| user_agent | VARCHAR(255) | - | - | Browser/client user agent |
| status | VARCHAR(50) | - | - | success, failure |
| created_at | TIMESTAMP | DEFAULT NOW(), INDEX | - | When action occurred |

**RLS Policy**: All reads filtered by `tenant_id`

---

## 11. Multi-Tenancy & RLS Implementation

### 11.1 RLS Policy Configuration

All tables marked with **✓ RLS** enforce Row-Level Security through PostgreSQL policies:

```sql
-- Example RLS policy for products table
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_products ON products
  USING (tenant_id = CURRENT_SETTING('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = CURRENT_SETTING('app.current_tenant_id')::uuid);

-- In application middleware before each request:
-- SET app.current_tenant_id = '<extracted-tenant-id>';
```

### 11.2 Tenant Context Propagation

**Pattern**: Extract tenant_id from JWT or request header → Set PostgreSQL session variable → Execute queries

```typescript
// Pseudocode example
app.use(async (ctx, next) => {
  const tenantId = extractTenantId(ctx); // from JWT or header
  
  // Set PostgreSQL session variable
  await db.query('SET app.current_tenant_id = $1', [tenantId]);
  
  ctx.tenant = { id: tenantId };
  await next();
});
```

---

## 12. Indexing Strategy

### 12.1 Key Indexes for Performance

```sql
-- Tenant-based queries (critical for multi-tenancy)
CREATE INDEX idx_products_tenant_id ON products(tenant_id);
CREATE INDEX idx_orders_tenant_id ON orders(tenant_id);
CREATE INDEX idx_inventory_stock_ledger_tenant_id ON inventory_stock_ledger(tenant_id);

-- Search & filtering
CREATE INDEX idx_products_sku ON products(tenant_id, sku);
CREATE INDEX idx_orders_customer_id ON orders(tenant_id, customer_id);
CREATE INDEX idx_orders_status ON orders(tenant_id, status);

-- Time-series queries
CREATE INDEX idx_inventory_stock_ledger_created ON inventory_stock_ledger(tenant_id, created_at DESC);
CREATE INDEX idx_payments_created ON payments(tenant_id, created_at DESC);

-- Foreign key relationships
CREATE INDEX idx_po_items_po_id ON procurement_order_items(po_id);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ClickHouse (partition key + order by)
CREATE TABLE events (...)
ENGINE = MergeTree()
ORDER BY (tenant_id, timestamp)
PARTITION BY toYYYYMM(timestamp);
```

---

## 13. Cross-References to Event Catalog

This canonical data model defines the entities that are acted upon in the [Event Catalog](./event-catalog.md). Key relationships:

| Entity | Related Events | Event Link |
|--------|---|---|
| `procurement_orders` | po.created, po.acknowledged, po.received, po.invoiced | [Procurement Events](./event-catalog.md#procurement-events) |
| `products` | product.created, product.updated, product.deleted | [Catalog Events](./event-catalog.md#catalog-events) |
| `orders` | order.created, order.confirmed, order.shipped | [Order Events](./event-catalog.md#order-events) |
| `invoices` | invoice.created, payment.received, payment.failed | [Finance Events](./event-catalog.md#finance-events) |
| `price_lists` | price_list.created, price_list.activated | [Pricing Events](./event-catalog.md#pricing-events) |
| `ai_telemetry_*` | model.training_completed, inference.performed | [AI Telemetry Events](./event-catalog.md#ai-telemetry-events) |

---

## 14. Sample ERD (Consolidated View)

```
┌──────────────────┐
│     tenants      │◄──────┬─────────────┬─────────────────────┐
├──────────────────┤       │             │                     │
│ tenant_id (PK)   │       │             │                     │
│ name             │       │             │                     │
└──────────────────┘       │             │                     │
       │                   │             │                     │
       │◄──────────────────┼─────────────┼─────────────────────┤
       │ 1:N               │             │                     │
       ▼                   │             │                     │
┌──────────────────┐       │             │                     │
│     brands       │       │             │                     │
├──────────────────┤       │             │                     │
│ brand_id (PK)    │       │             │                     │
│ tenant_id (FK)   │       │             │                     │
│ name             │       │             │                     │
└────┬─────────────┘       │             │                     │
     │ 1:N                 │             │                     │
     ▼                     │             │                     │
┌──────────────────┐       │             │                     │
│    locations     │       │             │                     │
├──────────────────┤       │             │                     │
│ location_id (PK) │       │             │                     │
│ brand_id (FK)    │       │             │                     │
│ tenant_id (FK)   │       │             │                     │
└──────────────────┘       │             │                     │
                           │             │                     │
                    ┌──────▼─────────────┬──────────────────────┤
                    │                    │                      │
                    ▼                    ▼                      ▼
              ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐
              │   products   │   │   customers  │   │  procurement_orders│
              ├──────────────┤   ├──────────────┤   ├────────────────────┤
              │ product_id   │   │ customer_id  │   │ po_id              │
              │ tenant_id    │   │ tenant_id    │   │ tenant_id          │
              │ sku          │   │ email        │   │ supplier_id (FK)   │
              │ name         │   │ name         │   │ total_cents        │
              └──┬───────────┘   └──────┬───────┘   └─────┬──────────────┘
                 │ 1:N                 │ 1:N             │ 1:N
                 ▼                     ▼                 ▼
          ┌─────────────────┐  ┌──────────────┐  ┌─────────────────────┐
          │ product_variants│  │    orders    │  │procurement_order_   │
          ├─────────────────┤  ├──────────────┤  │   items             │
          │ variant_id      │  │ order_id     │  ├─────────────────────┤
          │ product_id      │  │ customer_id  │  │ po_item_id          │
          │ sku             │  │ tenant_id    │  │ product_id (FK)     │
          └─────────────────┘  └─────┬────────┘  │ quantity            │
                                     │           └─────────────────────┘
                                     ▼ 1:N
                             ┌──────────────────┐
                             │   order_items    │
                             ├──────────────────┤
                             │ order_item_id    │
                             │ order_id (FK)    │
                             │ product_id (FK)  │
                             │ quantity         │
                             └──────────────────┘
                                     │
                                     │
                             ┌───────▼────────┐
                             │   shipments    │
                             ├────────────────┤
                             │ shipment_id    │
                             │ order_id (FK)  │
                             │ tracking_#     │
                             │ carrier        │
                             └────────────────┘

Finance Relationships:
    orders ◄──── invoices ────► payments
       │ 1:N
       ▼
   1 order → 1 invoice (at minimum) → N payments


Inventory:
    products ◄──── inventory_current_stock
              └────► inventory_stock_ledger
                     (tracks all movements)
```

---

## 15. Versioning & Evolution

- All table definitions include `created_at` and `updated_at` timestamps for audit trail
- JSONB `metadata` columns are reserved for tenant-specific extensions without schema changes
- Schema migrations are versioned and tracked in `schema_versions` table (not shown here)
- Breaking changes to core entities require a major version bump and migration plan

---

## Appendix: Key Definitions

**RLS (Row-Level Security)**: PostgreSQL feature enabling row-level access control. Rows are automatically filtered based on policies (in our case, tenant_id matching).

**Idempotency Key**: A unique identifier ensuring that duplicate event processing produces the same result.

**JSONB**: PostgreSQL's binary JSON type, allowing fast queries on nested data while maintaining flexibility.

**ClickHouse**: Columnar OLAP database optimized for analytical queries across large event streams.

**Multi-tenancy Identifier**: `tenant_id` field present in all transaction tables for isolation and billing.

---

**Last Updated**: 2024-12-16  
**Version**: 1.0  
**Status**: Active
