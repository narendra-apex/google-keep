-- Phase 1: Tenant DB setup (PostgreSQL)
-- Canonical hierarchy: Org -> Brand -> Location
-- All tables include tenant_id + auditing columns (created_at, updated_at, deleted_at)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION app.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Org (tenant root)
CREATE TABLE IF NOT EXISTS orgs (
  org_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL UNIQUE,
  name text NOT NULL,
  legal_name text,
  registration_id text,
  primary_currency varchar(3) NOT NULL DEFAULT 'USD',
  tax_jurisdiction text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT orgs_org_tenant_unique UNIQUE (org_id, tenant_id)
);

DROP TRIGGER IF EXISTS orgs_set_updated_at ON orgs;
CREATE TRIGGER orgs_set_updated_at
BEFORE UPDATE ON orgs
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Brand
CREATE TABLE IF NOT EXISTS brands (
  brand_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  org_id uuid NOT NULL,
  name text NOT NULL,
  color text,
  logo_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT brands_org_fk
    FOREIGN KEY (org_id, tenant_id)
    REFERENCES orgs(org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT brands_brand_org_tenant_unique UNIQUE (brand_id, org_id, tenant_id)
);

DROP TRIGGER IF EXISTS brands_set_updated_at ON brands;
CREATE TRIGGER brands_set_updated_at
BEFORE UPDATE ON brands
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Location
CREATE TABLE IF NOT EXISTS locations (
  location_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  org_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'warehouse',
  address jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT locations_brand_fk
    FOREIGN KEY (brand_id, org_id, tenant_id)
    REFERENCES brands(brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT locations_location_brand_org_tenant_unique UNIQUE (location_id, brand_id, org_id, tenant_id)
);

DROP TRIGGER IF EXISTS locations_set_updated_at ON locations;
CREATE TRIGGER locations_set_updated_at
BEFORE UPDATE ON locations
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Product
CREATE TABLE IF NOT EXISTS products (
  product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  org_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  sku varchar(100) NOT NULL,
  name text NOT NULL,
  description text,
  status varchar(50) NOT NULL DEFAULT 'active',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT products_brand_fk
    FOREIGN KEY (brand_id, org_id, tenant_id)
    REFERENCES brands(brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT products_sku_unique UNIQUE (tenant_id, sku),
  CONSTRAINT products_product_brand_org_tenant_unique UNIQUE (product_id, brand_id, org_id, tenant_id)
);

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Supplier
CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  org_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  name text NOT NULL,
  contact_email text,
  payment_account jsonb,
  rating numeric(3,2) NOT NULL DEFAULT 5.0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT suppliers_brand_fk
    FOREIGN KEY (brand_id, org_id, tenant_id)
    REFERENCES brands(brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT suppliers_supplier_brand_org_tenant_unique UNIQUE (supplier_id, brand_id, org_id, tenant_id)
);

DROP TRIGGER IF EXISTS suppliers_set_updated_at ON suppliers;
CREATE TRIGGER suppliers_set_updated_at
BEFORE UPDATE ON suppliers
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Customer
CREATE TABLE IF NOT EXISTS customers (
  customer_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  org_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  last_name text,
  phone text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT customers_brand_fk
    FOREIGN KEY (brand_id, org_id, tenant_id)
    REFERENCES brands(brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT customers_email_unique UNIQUE (tenant_id, email),
  CONSTRAINT customers_customer_brand_org_tenant_unique UNIQUE (customer_id, brand_id, org_id, tenant_id)
);

DROP TRIGGER IF EXISTS customers_set_updated_at ON customers;
CREATE TRIGGER customers_set_updated_at
BEFORE UPDATE ON customers
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Inventory (current stock snapshot)
CREATE TABLE IF NOT EXISTS inventory (
  inventory_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  org_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  product_id uuid NOT NULL,
  location_id uuid NOT NULL,
  on_hand_quantity bigint NOT NULL DEFAULT 0,
  allocated_quantity bigint NOT NULL DEFAULT 0,
  reserved_quantity bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT inventory_product_fk
    FOREIGN KEY (product_id, brand_id, org_id, tenant_id)
    REFERENCES products(product_id, brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT inventory_location_fk
    FOREIGN KEY (location_id, brand_id, org_id, tenant_id)
    REFERENCES locations(location_id, brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT inventory_product_location_unique UNIQUE (tenant_id, product_id, location_id)
);

DROP TRIGGER IF EXISTS inventory_set_updated_at ON inventory;
CREATE TRIGGER inventory_set_updated_at
BEFORE UPDATE ON inventory
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Purchase Order
CREATE TABLE IF NOT EXISTS purchase_orders (
  purchase_order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  org_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  location_id uuid,
  po_number varchar(100) NOT NULL,
  order_date timestamptz NOT NULL DEFAULT now(),
  delivery_date timestamptz,
  total_amount_cents bigint NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  status varchar(50) NOT NULL DEFAULT 'draft',
  payment_terms varchar(100),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT purchase_orders_brand_fk
    FOREIGN KEY (brand_id, org_id, tenant_id)
    REFERENCES brands(brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT purchase_orders_supplier_fk
    FOREIGN KEY (supplier_id, brand_id, org_id, tenant_id)
    REFERENCES suppliers(supplier_id, brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT purchase_orders_location_fk
    FOREIGN KEY (location_id, brand_id, org_id, tenant_id)
    REFERENCES locations(location_id, brand_id, org_id, tenant_id)
    ON DELETE SET NULL,
  CONSTRAINT purchase_orders_po_number_unique UNIQUE (tenant_id, po_number)
);

DROP TRIGGER IF EXISTS purchase_orders_set_updated_at ON purchase_orders;
CREATE TRIGGER purchase_orders_set_updated_at
BEFORE UPDATE ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Order
CREATE TABLE IF NOT EXISTS orders (
  order_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  org_id uuid NOT NULL,
  brand_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  location_id uuid,
  order_number varchar(100) NOT NULL,
  status varchar(50) NOT NULL DEFAULT 'pending',
  order_date timestamptz NOT NULL DEFAULT now(),
  subtotal_cents bigint NOT NULL DEFAULT 0,
  tax_cents bigint NOT NULL DEFAULT 0,
  shipping_cost_cents bigint NOT NULL DEFAULT 0,
  discount_cents bigint NOT NULL DEFAULT 0,
  total_cents bigint NOT NULL DEFAULT 0,
  currency varchar(3) NOT NULL DEFAULT 'USD',
  payment_method varchar(50),
  shipping_method varchar(50),
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT orders_brand_fk
    FOREIGN KEY (brand_id, org_id, tenant_id)
    REFERENCES brands(brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT orders_customer_fk
    FOREIGN KEY (customer_id, brand_id, org_id, tenant_id)
    REFERENCES customers(customer_id, brand_id, org_id, tenant_id)
    ON DELETE CASCADE,
  CONSTRAINT orders_location_fk
    FOREIGN KEY (location_id, brand_id, org_id, tenant_id)
    REFERENCES locations(location_id, brand_id, org_id, tenant_id)
    ON DELETE SET NULL,
  CONSTRAINT orders_order_number_unique UNIQUE (tenant_id, order_number)
);

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();

-- Indexes (tenant-first)
CREATE INDEX IF NOT EXISTS idx_orgs_tenant_id ON orgs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_brands_tenant_id ON brands(tenant_id);
CREATE INDEX IF NOT EXISTS idx_locations_tenant_id ON locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_id ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant_id ON suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inventory_tenant_id ON inventory(tenant_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_id ON orders(tenant_id);

-- Row Level Security
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

ALTER TABLE orgs FORCE ROW LEVEL SECURITY;
ALTER TABLE brands FORCE ROW LEVEL SECURITY;
ALTER TABLE locations FORCE ROW LEVEL SECURITY;
ALTER TABLE products FORCE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE inventory FORCE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders FORCE ROW LEVEL SECURITY;
ALTER TABLE orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_orgs ON orgs;
CREATE POLICY tenant_isolation_orgs ON orgs
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_brands ON brands;
CREATE POLICY tenant_isolation_brands ON brands
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_locations ON locations;
CREATE POLICY tenant_isolation_locations ON locations
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_products ON products;
CREATE POLICY tenant_isolation_products ON products
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_suppliers ON suppliers;
CREATE POLICY tenant_isolation_suppliers ON suppliers
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_customers ON customers;
CREATE POLICY tenant_isolation_customers ON customers
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_inventory ON inventory;
CREATE POLICY tenant_isolation_inventory ON inventory
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_purchase_orders ON purchase_orders;
CREATE POLICY tenant_isolation_purchase_orders ON purchase_orders
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_orders ON orders;
CREATE POLICY tenant_isolation_orders ON orders
  USING (tenant_id = app.current_tenant_id())
  WITH CHECK (tenant_id = app.current_tenant_id());
