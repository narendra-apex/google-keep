-- Phase 1: ClickHouse analytical mirror of core entities
-- Mirrors: Org, Brand, Location, Product, Supplier, Inventory, PurchaseOrder, Order, Customer

CREATE DATABASE IF NOT EXISTS ucom_analytics;

-- Dimensions
CREATE TABLE IF NOT EXISTS ucom_analytics.dim_orgs (
  tenant_id UUID,
  org_id UUID,
  name String,
  legal_name Nullable(String),
  primary_currency LowCardinality(String),
  created_at DateTime,
  updated_at DateTime,
  deleted_at Nullable(DateTime)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, org_id);

CREATE TABLE IF NOT EXISTS ucom_analytics.dim_brands (
  tenant_id UUID,
  org_id UUID,
  brand_id UUID,
  name String,
  created_at DateTime,
  updated_at DateTime,
  deleted_at Nullable(DateTime)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, org_id, brand_id);

CREATE TABLE IF NOT EXISTS ucom_analytics.dim_locations (
  tenant_id UUID,
  org_id UUID,
  brand_id UUID,
  location_id UUID,
  name String,
  type LowCardinality(String),
  created_at DateTime,
  updated_at DateTime,
  deleted_at Nullable(DateTime)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, org_id, brand_id, location_id);

CREATE TABLE IF NOT EXISTS ucom_analytics.dim_products (
  tenant_id UUID,
  org_id UUID,
  brand_id UUID,
  product_id UUID,
  sku String,
  name String,
  status LowCardinality(String),
  created_at DateTime,
  updated_at DateTime,
  deleted_at Nullable(DateTime)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, org_id, brand_id, product_id);

CREATE TABLE IF NOT EXISTS ucom_analytics.dim_suppliers (
  tenant_id UUID,
  org_id UUID,
  brand_id UUID,
  supplier_id UUID,
  name String,
  rating Float32,
  created_at DateTime,
  updated_at DateTime,
  deleted_at Nullable(DateTime)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, org_id, brand_id, supplier_id);

CREATE TABLE IF NOT EXISTS ucom_analytics.dim_customers (
  tenant_id UUID,
  org_id UUID,
  brand_id UUID,
  customer_id UUID,
  email String,
  created_at DateTime,
  updated_at DateTime,
  deleted_at Nullable(DateTime)
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, org_id, brand_id, customer_id);

-- Facts
CREATE TABLE IF NOT EXISTS ucom_analytics.fact_inventory (
  snapshot_at DateTime,
  tenant_id UUID,
  org_id UUID,
  brand_id UUID,
  product_id UUID,
  location_id UUID,
  on_hand_quantity Int64,
  allocated_quantity Int64,
  reserved_quantity Int64
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(snapshot_at)
ORDER BY (tenant_id, snapshot_at, product_id, location_id);

CREATE TABLE IF NOT EXISTS ucom_analytics.fact_purchase_orders (
  order_date DateTime,
  tenant_id UUID,
  org_id UUID,
  brand_id UUID,
  purchase_order_id UUID,
  supplier_id UUID,
  location_id Nullable(UUID),
  po_number String,
  status LowCardinality(String),
  total_amount_cents Int64,
  currency LowCardinality(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(order_date)
ORDER BY (tenant_id, order_date, purchase_order_id);

CREATE TABLE IF NOT EXISTS ucom_analytics.fact_orders (
  order_date DateTime,
  tenant_id UUID,
  org_id UUID,
  brand_id UUID,
  order_id UUID,
  customer_id UUID,
  location_id Nullable(UUID),
  order_number String,
  status LowCardinality(String),
  subtotal_cents Int64,
  tax_cents Int64,
  shipping_cost_cents Int64,
  discount_cents Int64,
  total_cents Int64,
  currency LowCardinality(String)
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(order_date)
ORDER BY (tenant_id, order_date, order_id);
