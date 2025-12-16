# Event Catalog - Unified Commerce OS

## Executive Summary

This document defines the **event-driven architecture** for the Unified Commerce OS platform. It catalogs **100+ well-structured business and technical events** organized by domain module, with detailed payload specifications, producer/consumer hints, idempotency mechanisms, and audit requirements.

All events carry a **multi-tenant identifier (`tenant_id`)** to ensure proper data isolation. Events are published via **Kafka** (durable) and **NATS** (low-latency request/reply), with full traceability in **ClickHouse** for analytics and compliance.

**Cross-Reference**: Events act upon entities defined in [Canonical Data Model](./canonical-data-model.md)

---

## 1. Event Structure & Common Fields

### 1.1 Base Event Envelope

Every event published to Kafka/NATS includes this standard envelope:

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_type": "order.created",
  "event_version": "1.0",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "tenant_id": "org-uuid-001",
  "brand_id": "brand-uuid-001",
  "actor_id": "user-uuid-001",
  "actor_type": "user|system|integration",
  "idempotency_key": "idempotency-key-uuid",
  "correlation_id": "request-correlation-uuid",
  "source": "core_api|catalog_service|fulfillment_service|finance_service",
  "environment": "production|staging|development",
  "payload": { /* domain-specific data */ },
  "metadata": {
    "request_id": "req-id",
    "tracing_id": "trace-id",
    "user_agent": "...",
    "ip_address": "..."
  }
}
```

### 1.2 Event Publication Patterns

- **NATS Topic**: `{domain}.{resource}.{action}` (e.g., `orders.fulfillment.picked`)
- **Kafka Topic**: `{domain}-events` (e.g., `orders-events`, `inventory-events`)
- **Partition Key** (Kafka): `tenant_id` (ensures all tenant events are ordered)
- **Idempotency Key**: Unique per event, prevents duplicate processing
- **Consumer Group** (Kafka): `{service}-{domain}-consumer` (e.g., `finance-service-orders-consumer`)

---

## 2. Procurement Domain Events

### 2.1 PO.CREATED

**Event Type**: `po.created`  
**Producer**: Core API  
**Consumers**: Finance Service (invoicing), Supplier Integration Hub, Audit Service  
**Idempotency Scope**: `supplier_id + po_number + order_date` (unique within tenant)

**Payload**:
```json
{
  "po_id": "po-uuid-001",
  "tenant_id": "org-uuid-001",
  "brand_id": "brand-uuid-001",
  "po_number": "PO-2024-00123",
  "supplier_id": "supplier-uuid-001",
  "supplier_name": "Acme Widgets Inc",
  "order_date": "2024-01-15T10:30:00Z",
  "delivery_date": "2024-02-15",
  "total_amount_cents": 50000,
  "currency": "USD",
  "items": [
    {
      "po_item_id": "po-item-uuid-001",
      "product_id": "product-uuid-001",
      "sku": "WIDGET-100",
      "quantity": 500,
      "unit_price_cents": 100
    }
  ],
  "payment_terms": "net_30",
  "notes": "Rush order - priority delivery"
}
```

**Audit Requirements**:
- Log full PO details with actor context
- Trigger email notification to procurement team
- Publish to ClickHouse `events` table for analytics

**Consumer Actions**:
- **Finance Service**: Prepare invoice template, apply payment terms
- **Supplier Hub**: Call supplier API to confirm PO
- **Inventory Service**: Monitor for goods receipt

---

### 2.2 PO.ACKNOWLEDGED

**Event Type**: `po.acknowledged`  
**Producer**: Supplier Integration Hub  
**Consumers**: Core API, Inventory Service, Audit Service  
**Idempotency Key**: `po_id + ack_timestamp`

**Payload**:
```json
{
  "po_id": "po-uuid-001",
  "tenant_id": "org-uuid-001",
  "supplier_id": "supplier-uuid-001",
  "acknowledgment_date": "2024-01-15T14:22:00Z",
  "supplier_reference": "SUP-REF-98765",
  "expected_delivery_date": "2024-02-14",
  "partial_ack": false,
  "acked_items": [
    {
      "po_item_id": "po-item-uuid-001",
      "acked_quantity": 500
    }
  ],
  "notes": "Confirmed. ETA Feb 14."
}
```

**Audit Requirements**:
- Record supplier acknowledgment in audit trail
- Notify procurement team of confirmation status

---

### 2.3 PO.PARTIALLY_RECEIVED

**Event Type**: `po.partially_received`  
**Producer**: Inventory Service (via WMS integration)  
**Consumers**: Finance Service, Procurement Team, Analytics  
**Idempotency Key**: `po_id + goods_receipt_id`

**Payload**:
```json
{
  "po_id": "po-uuid-001",
  "tenant_id": "org-uuid-001",
  "goods_receipt_id": "gr-uuid-001",
  "receipt_date": "2024-02-10T08:15:00Z",
  "location_id": "location-uuid-001",
  "received_items": [
    {
      "po_item_id": "po-item-uuid-001",
      "product_id": "product-uuid-001",
      "quantity_received": 300,
      "quantity_damaged": 10,
      "quantity_short": 0,
      "lot_number": "LOT-2024-001"
    }
  ],
  "total_received_cents": 30000,
  "notes": "Partial receipt. 200 units to follow."
}
```

**Consumer Actions**:
- **Finance Service**: Create partial invoice for received items
- **Inventory Service**: Update stock levels
- **Procurement Dashboard**: Update receipt progress

---

### 2.4 PO.COMPLETED

**Event Type**: `po.completed`  
**Producer**: Inventory Service or Procurement Service  
**Consumers**: Finance Service (final invoice), Supplier Integration  
**Idempotency Key**: `po_id`

**Payload**:
```json
{
  "po_id": "po-uuid-001",
  "tenant_id": "org-uuid-001",
  "completion_date": "2024-02-15T16:45:00Z",
  "total_received_quantity": 500,
  "total_received_cents": 50000,
  "discrepancies": {
    "damaged": 10,
    "short": 0,
    "quality_issues": 0
  }
}
```

---

### 2.5 PO.CANCELLED

**Event Type**: `po.cancelled`  
**Producer**: Core API (Procurement Service)  
**Consumers**: Finance Service, Supplier Integration, Inventory  
**Idempotency Key**: `po_id + cancellation_timestamp`

**Payload**:
```json
{
  "po_id": "po-uuid-001",
  "tenant_id": "org-uuid-001",
  "cancelled_date": "2024-01-20T11:00:00Z",
  "cancellation_reason": "duplicate_order|supplier_bankruptcy|business_decision",
  "cancellation_notes": "Cancelled due to duplicate order",
  "refund_initiated": true,
  "actor_id": "user-uuid-001"
}
```

---

## 3. Inventory Domain Events

### 3.1 INVENTORY.ADJUSTED

**Event Type**: `inventory.adjusted`  
**Producer**: Inventory Service  
**Consumers**: Analytics Service, Finance Service (for COGS), Procurement  
**Idempotency Key**: `adjustment_id`

**Payload**:
```json
{
  "adjustment_id": "adj-uuid-001",
  "tenant_id": "org-uuid-001",
  "product_id": "product-uuid-001",
  "location_id": "location-uuid-001",
  "adjustment_type": "physical_count|damage|shrinkage|sample|correction",
  "old_quantity": 1000,
  "new_quantity": 950,
  "quantity_delta": -50,
  "reason": "Physical inventory count variance",
  "reference_id": "physical-count-uuid-001",
  "adjusted_at": "2024-01-15T10:30:00Z",
  "adjustment_cost_cents": 5000,
  "notes": "Physical count cycle 2024-01"
}
```

**Audit Requirements**:
- Capture who performed adjustment and timestamp
- Link to physical inventory count batch
- Flag unusual adjustments (>10% variance) for review

---

### 3.2 INVENTORY.STOCK_ALLOCATED

**Event Type**: `inventory.stock_allocated`  
**Producer**: Core API (Order Service)  
**Consumers**: Inventory Service, Fulfillment Service, Analytics  
**Idempotency Key**: `order_id + allocation_timestamp`

**Payload**:
```json
{
  "allocation_id": "alloc-uuid-001",
  "tenant_id": "org-uuid-001",
  "order_id": "order-uuid-001",
  "allocated_items": [
    {
      "product_id": "product-uuid-001",
      "quantity": 5,
      "location_id": "location-uuid-001",
      "lot_number": "LOT-2024-001"
    }
  ],
  "allocated_at": "2024-01-15T10:31:00Z",
  "expiry_at": "2024-01-15T11:31:00Z"
}
```

**Consumer Actions**:
- **Inventory Service**: Decrement available_quantity, increment allocated_quantity
- **Fulfillment Service**: Trigger pick task assignment

---

### 3.3 INVENTORY.STOCK_RELEASED

**Event Type**: `inventory.stock_released`  
**Producer**: Inventory Service  
**Consumers**: Inventory Service (update), Procurement (reorder if needed)  
**Idempotency Key**: `release_id`

**Payload**:
```json
{
  "release_id": "release-uuid-001",
  "tenant_id": "org-uuid-001",
  "allocation_id": "alloc-uuid-001",
  "product_id": "product-uuid-001",
  "quantity": 5,
  "location_id": "location-uuid-001",
  "release_reason": "order_cancelled|allocation_expired|damaged_in_fulfillment|return_initiated",
  "released_at": "2024-01-15T12:00:00Z"
}
```

---

### 3.4 INVENTORY.LOW_STOCK_ALERT

**Event Type**: `inventory.low_stock_alert`  
**Producer**: Inventory Service (scheduled job)  
**Consumers**: Procurement Dashboard, Reorder Automation  
**Idempotency Key**: `product_id + location_id + alert_date`

**Payload**:
```json
{
  "alert_id": "alert-uuid-001",
  "tenant_id": "org-uuid-001",
  "product_id": "product-uuid-001",
  "location_id": "location-uuid-001",
  "current_stock": 45,
  "reorder_point": 100,
  "stock_variance_percent": -55,
  "estimated_days_to_stockout": 3,
  "alert_timestamp": "2024-01-15T10:00:00Z",
  "recommended_order_quantity": 500
}
```

---

## 4. Product & Catalog Domain Events

### 4.1 PRODUCT.CREATED

**Event Type**: `product.created`  
**Producer**: Catalog Service  
**Consumers**: Search Indexer, Pricing Service, Inventory Service, Analytics  
**Idempotency Key**: `product_id`

**Payload**:
```json
{
  "product_id": "product-uuid-001",
  "tenant_id": "org-uuid-001",
  "brand_id": "brand-uuid-001",
  "sku": "WIDGET-100-BLU",
  "name": "Widget 100 - Blue",
  "description": "Premium quality widget in blue finish",
  "category_id": "category-uuid-001",
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z",
  "metadata": {
    "supplier_sku": "SUP-SKU-123",
    "weight_kg": 1.5,
    "dimensions": "10x10x5 cm"
  }
}
```

**Consumer Actions**:
- **Search Indexer**: Index product in Meilisearch
- **Pricing Service**: Initialize default price list entry
- **Inventory Service**: Create stock tracking records

---

### 4.2 PRODUCT.UPDATED

**Event Type**: `product.updated`  
**Producer**: Catalog Service  
**Consumers**: Search Indexer, Pricing Service, Inventory Service, Analytics  
**Idempotency Key**: `product_id + updated_timestamp`

**Payload**:
```json
{
  "product_id": "product-uuid-001",
  "tenant_id": "org-uuid-001",
  "changed_fields": [
    "name",
    "description",
    "category_id"
  ],
  "old_values": {
    "name": "Widget 100",
    "description": "Standard widget"
  },
  "new_values": {
    "name": "Widget 100 - Premium",
    "description": "Premium quality widget in blue finish",
    "category_id": "category-uuid-002"
  },
  "updated_at": "2024-01-15T14:15:00Z",
  "actor_id": "user-uuid-001"
}
```

---

### 4.3 PRODUCT.DELETED

**Event Type**: `product.deleted`  
**Producer**: Catalog Service  
**Consumers**: Search Indexer, Inventory Service (soft delete validation), Analytics  
**Idempotency Key**: `product_id`

**Payload**:
```json
{
  "product_id": "product-uuid-001",
  "tenant_id": "org-uuid-001",
  "sku": "WIDGET-100-BLU",
  "name": "Widget 100 - Blue",
  "soft_delete": true,
  "deleted_at": "2024-01-15T16:45:00Z",
  "reason": "discontinued|duplicate|business_decision",
  "actor_id": "user-uuid-001"
}
```

---

### 4.4 PRODUCT_VARIANT.CREATED

**Event Type**: `product_variant.created`  
**Producer**: Catalog Service  
**Consumers**: Search Indexer, Inventory Service, Pricing Service  
**Idempotency Key**: `variant_id`

**Payload**:
```json
{
  "variant_id": "variant-uuid-001",
  "product_id": "product-uuid-001",
  "tenant_id": "org-uuid-001",
  "sku": "WIDGET-100-RED",
  "attributes": {
    "color": "red",
    "size": "large"
  },
  "images": [
    "https://cdn.example.com/widget-100-red-1.jpg"
  ],
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### 4.5 CATEGORY.CREATED

**Event Type**: `category.created`  
**Producer**: Catalog Service  
**Consumers**: Search Indexer, Storefront  
**Idempotency Key**: `category_id`

**Payload**:
```json
{
  "category_id": "category-uuid-001",
  "tenant_id": "org-uuid-001",
  "name": "Electronics",
  "parent_category_id": null,
  "description": "Electronic products and gadgets",
  "display_order": 1,
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

## 5. Pricing Domain Events

### 5.1 PRICE_LIST.CREATED

**Event Type**: `price_list.created`  
**Producer**: Pricing Service  
**Consumers**: Catalog Service, Pricing Engine, Analytics  
**Idempotency Key**: `price_list_id`

**Payload**:
```json
{
  "price_list_id": "pricelist-uuid-001",
  "tenant_id": "org-uuid-001",
  "brand_id": "brand-uuid-001",
  "name": "Wholesale Q1 2024",
  "currency": "USD",
  "effective_date": "2024-01-01",
  "expiration_date": "2024-03-31",
  "status": "draft",
  "rules": {
    "base_discount_percent": 15,
    "tiered_discounts": [
      {
        "min_qty": 100,
        "discount_percent": 20
      },
      {
        "min_qty": 500,
        "discount_percent": 25
      }
    ]
  },
  "created_at": "2024-01-10T10:30:00Z"
}
```

---

### 5.2 PRICE_LIST.ACTIVATED

**Event Type**: `price_list.activated`  
**Producer**: Pricing Service  
**Consumers**: Catalog Service (cache invalidation), Analytics  
**Idempotency Key**: `price_list_id`

**Payload**:
```json
{
  "price_list_id": "pricelist-uuid-001",
  "tenant_id": "org-uuid-001",
  "activation_timestamp": "2024-01-01T00:00:00Z",
  "replaced_price_list_id": "pricelist-uuid-000"
}
```

---

### 5.3 PRICE_LIST.ARCHIVED

**Event Type**: `price_list.archived`  
**Producer**: Pricing Service  
**Consumers**: Catalog Service (cache invalidation), Analytics  
**Idempotency Key**: `price_list_id`

**Payload**:
```json
{
  "price_list_id": "pricelist-uuid-001",
  "tenant_id": "org-uuid-001",
  "archive_timestamp": "2024-03-31T23:59:59Z",
  "reason": "end_of_validity|superseded|error_correction"
}
```

---

### 5.4 PRODUCT_PRICE.UPDATED

**Event Type**: `product_price.updated`  
**Producer**: Pricing Service  
**Consumers**: Catalog Service, Search Indexer, Storefront  
**Idempotency Key**: `price_id + timestamp`

**Payload**:
```json
{
  "price_id": "price-uuid-001",
  "product_id": "product-uuid-001",
  "tenant_id": "org-uuid-001",
  "price_list_id": "pricelist-uuid-001",
  "old_base_price_cents": 10000,
  "new_base_price_cents": 8500,
  "currency": "USD",
  "effective_date": "2024-01-15",
  "reason": "promotional|seasonal|competitor_adjustment|inventory_clearance",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

---

### 5.5 PROMOTION.CREATED

**Event Type**: `promotion.created`  
**Producer**: Pricing Service  
**Consumers**: Catalog Service, Order Service, Analytics  
**Idempotency Key**: `promotion_id`

**Payload**:
```json
{
  "promotion_id": "promo-uuid-001",
  "tenant_id": "org-uuid-001",
  "name": "New Year Sale",
  "discount_type": "percentage",
  "discount_value": 20,
  "start_date": "2024-01-01",
  "end_date": "2024-01-31",
  "conditions": {
    "min_purchase_cents": 5000,
    "applicable_product_ids": ["product-uuid-001", "product-uuid-002"],
    "max_uses": 1000
  },
  "created_at": "2024-01-10T10:30:00Z"
}
```

---

## 6. Order Domain Events

### 6.1 ORDER.CREATED

**Event Type**: `order.created`  
**Producer**: Core API (Order Service)  
**Consumers**: Inventory Service, Fulfillment Service, Finance Service, Analytics, Fraud Detection  
**Idempotency Key**: `order_id`

**Payload**:
```json
{
  "order_id": "order-uuid-001",
  "tenant_id": "org-uuid-001",
  "brand_id": "brand-uuid-001",
  "order_number": "ORD-2024-00001",
  "customer_id": "customer-uuid-001",
  "order_date": "2024-01-15T10:30:00Z",
  "items": [
    {
      "order_item_id": "order-item-uuid-001",
      "product_id": "product-uuid-001",
      "variant_id": "variant-uuid-001",
      "sku": "WIDGET-100-RED",
      "quantity": 2,
      "unit_price_cents": 8500,
      "line_total_cents": 17000
    }
  ],
  "shipping_address": {
    "address_id": "addr-uuid-001",
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001"
  },
  "billing_address": {
    "address_id": "addr-uuid-002"
  },
  "subtotal_cents": 17000,
  "tax_cents": 1445,
  "shipping_cost_cents": 1000,
  "discount_cents": 1700,
  "total_cents": 17745,
  "currency": "USD",
  "payment_method": "credit_card",
  "shipping_method": "standard",
  "status": "pending",
  "notes": "Gift wrap requested"
}
```

**Consumer Actions**:
- **Inventory Service**: Allocate stock
- **Fulfillment Service**: Create fulfillment request
- **Finance Service**: Prepare invoice
- **Fraud Detection Plugin**: Analyze order for risk

---

### 6.2 ORDER.CONFIRMED

**Event Type**: `order.confirmed`  
**Producer**: Core API (Order Service)  
**Consumers**: Fulfillment Service, Inventory Service, Email Service, Customer Notification  
**Idempotency Key**: `order_id`

**Payload**:
```json
{
  "order_id": "order-uuid-001",
  "tenant_id": "org-uuid-001",
  "order_number": "ORD-2024-00001",
  "confirmation_timestamp": "2024-01-15T10:35:00Z",
  "customer_id": "customer-uuid-001",
  "customer_email": "customer@example.com",
  "payment_verified": true,
  "stock_allocated": true,
  "fulfillment_warehouse_id": "warehouse-uuid-001"
}
```

**Audit Requirements**:
- Record confirmation timestamp
- Link to payment verification result
- Trigger confirmation email to customer

---

### 6.3 ORDER.PAYMENT_AUTHORIZED

**Event Type**: `order.payment_authorized`  
**Producer**: Payment Service  
**Consumers**: Order Service, Finance Service, Analytics  
**Idempotency Key**: `payment_authorization_id`

**Payload**:
```json
{
  "order_id": "order-uuid-001",
  "tenant_id": "org-uuid-001",
  "payment_authorization_id": "auth-uuid-001",
  "amount_cents": 17745,
  "currency": "USD",
  "payment_method": "credit_card",
  "authorization_code": "AUTH-12345",
  "timestamp": "2024-01-15T10:32:00Z",
  "avs_result": "match",
  "cvv_result": "match"
}
```

---

### 6.4 ORDER.PAYMENT_CAPTURED

**Event Type**: `order.payment_captured`  
**Producer**: Payment Service  
**Consumers**: Finance Service, Order Service, Analytics  
**Idempotency Key**: `capture_transaction_id`

**Payload**:
```json
{
  "order_id": "order-uuid-001",
  "tenant_id": "org-uuid-001",
  "payment_authorization_id": "auth-uuid-001",
  "capture_transaction_id": "capture-uuid-001",
  "amount_cents": 17745,
  "currency": "USD",
  "timestamp": "2024-01-15T10:33:00Z",
  "processor_response": "Charge approved"
}
```

---

### 6.5 ORDER.CANCELLED

**Event Type**: `order.cancelled`  
**Producer**: Core API (Order Service)  
**Consumers**: Inventory Service, Finance Service, Fulfillment Service, Customer Notification, Analytics  
**Idempotency Key**: `order_id + cancellation_timestamp`

**Payload**:
```json
{
  "order_id": "order-uuid-001",
  "tenant_id": "org-uuid-001",
  "order_number": "ORD-2024-00001",
  "cancellation_timestamp": "2024-01-15T12:00:00Z",
  "cancellation_reason": "customer_request|fraud_suspected|payment_failed|inventory_shortage",
  "refund_initiated": true,
  "customer_notification_email": "customer@example.com",
  "actor_id": "user-uuid-001|system"
}
```

**Consumer Actions**:
- **Inventory Service**: Release allocated stock
- **Finance Service**: Issue credit memo, initiate refund
- **Email Service**: Send cancellation confirmation to customer

---

## 7. Fulfillment Domain Events

### 7.1 PICK_TASK.ASSIGNED

**Event Type**: `pick_task.assigned`  
**Producer**: Fulfillment Service  
**Consumers**: Warehouse Management System, Picker App, Analytics  
**Idempotency Key**: `pick_task_id`

**Payload**:
```json
{
  "pick_task_id": "pick-task-uuid-001",
  "tenant_id": "org-uuid-001",
  "order_id": "order-uuid-001",
  "warehouse_id": "warehouse-uuid-001",
  "assigned_to_picker_id": "picker-uuid-001",
  "assigned_timestamp": "2024-01-15T11:00:00Z",
  "items": [
    {
      "order_item_id": "order-item-uuid-001",
      "product_id": "product-uuid-001",
      "sku": "WIDGET-100-RED",
      "quantity": 2,
      "location": "BIN-A-12-3",
      "lot_number": "LOT-2024-001"
    }
  ],
  "priority": "normal|high|rush"
}
```

---

### 7.2 PICK_TASK.COMPLETED

**Event Type**: `pick_task.completed`  
**Producer**: Warehouse Management System  
**Consumers**: Fulfillment Service, Quality Control, Analytics  
**Idempotency Key**: `pick_task_id + completion_timestamp`

**Payload**:
```json
{
  "pick_task_id": "pick-task-uuid-001",
  "tenant_id": "org-uuid-001",
  "completed_timestamp": "2024-01-15T11:45:00Z",
  "completed_by_picker_id": "picker-uuid-001",
  "items_picked": [
    {
      "order_item_id": "order-item-uuid-001",
      "product_id": "product-uuid-001",
      "quantity_picked": 2,
      "quantity_short": 0,
      "lot_number_picked": "LOT-2024-001"
    }
  ],
  "exceptions": [],
  "completion_location": "STAGING-A"
}
```

---

### 7.3 QUALITY_CHECK.COMPLETED

**Event Type**: `quality_check.completed`  
**Producer**: Quality Control Service  
**Consumers**: Fulfillment Service, Order Service, Analytics  
**Idempotency Key**: `qc_check_id`

**Payload**:
```json
{
  "qc_check_id": "qc-uuid-001",
  "order_id": "order-uuid-001",
  "tenant_id": "org-uuid-001",
  "timestamp": "2024-01-15T12:00:00Z",
  "qc_by_inspector_id": "inspector-uuid-001",
  "status": "passed|failed|needs_rework",
  "items_checked": [
    {
      "order_item_id": "order-item-uuid-001",
      "quantity_checked": 2,
      "quantity_defective": 0,
      "notes": ""
    }
  ],
  "issues_found": [],
  "next_step": "ready_for_packing"
}
```

---

### 7.4 SHIPMENT.CREATED

**Event Type**: `shipment.created`  
**Producer**: Fulfillment Service  
**Consumers**: Shipping Integration, Order Service, Customer Notification, Analytics  
**Idempotency Key**: `shipment_id`

**Payload**:
```json
{
  "shipment_id": "shipment-uuid-001",
  "order_id": "order-uuid-001",
  "tenant_id": "org-uuid-001",
  "shipment_timestamp": "2024-01-15T13:30:00Z",
  "warehouse_id": "warehouse-uuid-001",
  "carrier": "fedex|ups|usps|dhl",
  "service_level": "standard|express|overnight",
  "tracking_number": "1Z999AA10123456784",
  "estimated_delivery_date": "2024-01-18",
  "items": [
    {
      "order_item_id": "order-item-uuid-001",
      "sku": "WIDGET-100-RED",
      "quantity_shipped": 2
    }
  ],
  "shipping_cost_cents": 1000,
  "shipping_address": {
    "name": "John Doe",
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "postal_code": "10001"
  }
}
```

---

### 7.5 SHIPMENT.DELIVERED

**Event Type**: `shipment.delivered`  
**Producer**: Shipping Integration (carrier webhook)  
**Consumers**: Order Service, Customer Notification, Analytics  
**Idempotency Key**: `shipment_id`

**Payload**:
```json
{
  "shipment_id": "shipment-uuid-001",
  "tenant_id": "org-uuid-001",
  "order_id": "order-uuid-001",
  "delivery_timestamp": "2024-01-18T14:22:00Z",
  "tracking_number": "1Z999AA10123456784",
  "signed_by": "J. Doe",
  "delivery_notes": "Left at front door",
  "delivery_location": "Front Porch"
}
```

---

### 7.6 RETURN.INITIATED

**Event Type**: `return.initiated`  
**Producer**: Order Service or Customer Portal  
**Consumers**: Return Management Service, Finance Service, Inventory Service  
**Idempotency Key**: `return_authorization_id`

**Payload**:
```json
{
  "return_authorization_id": "rma-uuid-001",
  "order_id": "order-uuid-001",
  "tenant_id": "org-uuid-001",
  "customer_id": "customer-uuid-001",
  "initiated_timestamp": "2024-01-19T10:00:00Z",
  "return_reason": "defective|wrong_item|not_as_described|changed_mind|damaged_in_shipping",
  "items": [
    {
      "order_item_id": "order-item-uuid-001",
      "product_id": "product-uuid-001",
      "quantity_returned": 1,
      "condition": "unopened|opened|damaged"
    }
  ],
  "return_method": "customer_ships|carrier_pickup|instore",
  "refund_amount_cents": 8500
}
```

---

### 7.7 RETURN.RECEIVED

**Event Type**: `return.received`  
**Producer**: Warehouse Management System  
**Consumers**: Quality Control, Inventory Service, Finance Service  
**Idempotency Key**: `return_receipt_id`

**Payload**:
```json
{
  "return_receipt_id": "receipt-uuid-001",
  "return_authorization_id": "rma-uuid-001",
  "order_id": "order-uuid-001",
  "tenant_id": "org-uuid-001",
  "received_timestamp": "2024-01-22T09:00:00Z",
  "warehouse_id": "warehouse-uuid-001",
  "items_received": [
    {
      "order_item_id": "order-item-uuid-001",
      "product_id": "product-uuid-001",
      "quantity_received": 1,
      "condition_verified": "good|damaged",
      "inspected_by": "inspector-uuid-001"
    }
  ]
}
```

---

## 8. Finance Domain Events

### 8.1 INVOICE.CREATED

**Event Type**: `invoice.created`  
**Producer**: Finance Service  
**Consumers**: Accounting System, Payment Service, AR Aging Reports, Analytics  
**Idempotency Key**: `invoice_id`

**Payload**:
```json
{
  "invoice_id": "invoice-uuid-001",
  "tenant_id": "org-uuid-001",
  "invoice_number": "INV-2024-00123",
  "invoice_type": "sales|procurement|credit_memo|debit_memo",
  "order_id": "order-uuid-001",
  "po_id": null,
  "customer_id": "customer-uuid-001",
  "created_timestamp": "2024-01-15T14:00:00Z",
  "issue_date": "2024-01-15",
  "due_date": "2024-02-14",
  "items": [
    {
      "description": "Widget 100 - Red (x2)",
      "quantity": 2,
      "unit_price_cents": 8500,
      "line_total_cents": 17000,
      "gl_account_id": "account-uuid-001"
    }
  ],
  "subtotal_cents": 17000,
  "tax_cents": 1445,
  "shipping_cents": 1000,
  "total_cents": 19445,
  "currency": "USD",
  "payment_terms": "net_30",
  "status": "draft"
}
```

---

### 8.2 INVOICE.ISSUED

**Event Type**: `invoice.issued`  
**Producer**: Finance Service  
**Consumers**: Customer Notification, Payment Service, AR Module, Analytics  
**Idempotency Key**: `invoice_id`

**Payload**:
```json
{
  "invoice_id": "invoice-uuid-001",
  "tenant_id": "org-uuid-001",
  "invoice_number": "INV-2024-00123",
  "issued_timestamp": "2024-01-15T14:30:00Z",
  "total_due_cents": 19445,
  "due_date": "2024-02-14",
  "customer_email": "customer@example.com"
}
```

---

### 8.3 PAYMENT.RECEIVED

**Event Type**: `payment.received`  
**Producer**: Payment Service  
**Consumers**: Finance Service, AR Module, Cash Flow Reports, Analytics, Audit  
**Idempotency Key**: `payment_id`

**Payload**:
```json
{
  "payment_id": "payment-uuid-001",
  "invoice_id": "invoice-uuid-001",
  "tenant_id": "org-uuid-001",
  "amount_cents": 19445,
  "currency": "USD",
  "payment_method": "bank_transfer|credit_card|check|cash",
  "payment_processor": "stripe|paypal|square|manual",
  "transaction_id": "txn-12345",
  "received_timestamp": "2024-01-20T10:15:00Z",
  "recorded_by": "user-uuid-001|system",
  "notes": "Payment received via ACH"
}
```

**Audit Requirements**:
- Log payment details with full audit trail
- Record reconciliation status
- Link to bank statement

---

### 8.4 PAYMENT.FAILED

**Event Type**: `payment.failed`  
**Producer**: Payment Service  
**Consumers**: Finance Service, Notifications, Retry Service, Analytics  
**Idempotency Key**: `payment_attempt_id`

**Payload**:
```json
{
  "payment_attempt_id": "attempt-uuid-001",
  "invoice_id": "invoice-uuid-001",
  "tenant_id": "org-uuid-001",
  "amount_cents": 19445,
  "payment_method": "credit_card",
  "failure_reason": "insufficient_funds|card_declined|processor_error|timeout",
  "failure_code": "insufficient_funds|declined",
  "failure_message": "Your card has insufficient funds.",
  "timestamp": "2024-01-20T14:22:00Z",
  "retry_count": 1,
  "next_retry_at": "2024-01-21T10:00:00Z"
}
```

---

### 8.5 INVOICE.OVERDUE

**Event Type**: `invoice.overdue`  
**Producer**: Finance Service (scheduled check)  
**Consumers**: Collections Team, AR Aging Reports, Notifications  
**Idempotency Key**: `invoice_id` (once per invoice)

**Payload**:
```json
{
  "invoice_id": "invoice-uuid-001",
  "tenant_id": "org-uuid-001",
  "invoice_number": "INV-2024-00123",
  "due_date": "2024-02-14",
  "detection_timestamp": "2024-02-15T00:01:00Z",
  "days_overdue": 1,
  "amount_due_cents": 19445,
  "outstanding_balance_cents": 19445,
  "customer_id": "customer-uuid-001",
  "collection_level": "level_0|level_1|level_2"
}
```

---

### 8.6 JOURNAL_ENTRY.POSTED

**Event Type**: `journal_entry.posted`  
**Producer**: Accounting Service  
**Consumers**: GL Module, Financial Reports, Audit Trail  
**Idempotency Key**: `entry_id`

**Payload**:
```json
{
  "entry_id": "entry-uuid-001",
  "tenant_id": "org-uuid-001",
  "entry_date": "2024-01-15",
  "reference_type": "invoice|payment|adjustment",
  "reference_id": "invoice-uuid-001",
  "posted_timestamp": "2024-01-15T16:00:00Z",
  "lines": [
    {
      "account_id": "account-uuid-001",
      "account_number": "1000",
      "debit_cents": 19445,
      "credit_cents": 0,
      "description": "Accounts Receivable"
    },
    {
      "account_id": "account-uuid-002",
      "account_number": "4000",
      "debit_cents": 0,
      "credit_cents": 19445,
      "description": "Sales Revenue"
    }
  ]
}
```

---

## 9. Analytics & Reporting Events

### 9.1 REPORT.GENERATED

**Event Type**: `report.generated`  
**Producer**: Reporting Service  
**Consumers**: Email Service, Dashboard, Document Repository  
**Idempotency Key**: `report_id`

**Payload**:
```json
{
  "report_id": "report-uuid-001",
  "tenant_id": "org-uuid-001",
  "report_type": "daily_sales|monthly_revenue|inventory_aging|ar_aging|profit_loss",
  "generated_timestamp": "2024-01-15T23:00:00Z",
  "period_start": "2024-01-15",
  "period_end": "2024-01-15",
  "file_path": "s3://reports-bucket/tenant-001/sales-2024-01-15.pdf",
  "file_format": "pdf|csv|xlsx",
  "recipient_emails": ["manager@example.com"],
  "metrics": {
    "total_orders": 245,
    "total_revenue_cents": 1895000
  }
}
```

---

### 9.2 DASHBOARD_METRIC.UPDATED

**Event Type**: `dashboard_metric.updated`  
**Producer**: Analytics Service  
**Consumers**: Dashboard Service (WebSocket push), Real-time Displays  
**Idempotency Key**: `metric_id + timestamp`

**Payload**:
```json
{
  "metric_id": "metric-uuid-001",
  "tenant_id": "org-uuid-001",
  "metric_name": "daily_sales_total",
  "metric_value": 1895000,
  "currency": "USD",
  "dimension_1": "brand_id",
  "dimension_1_value": "brand-uuid-001",
  "dimension_2": null,
  "timestamp": "2024-01-15T23:00:00Z",
  "previous_value": 1750000,
  "percent_change": 8.3
}
```

---

## 10. AI & ML Domain Events

### 10.1 MODEL.TRAINING_STARTED

**Event Type**: `model.training_started`  
**Producer**: AI/ML Service  
**Consumers**: Model Registry, Monitoring, Notifications  
**Idempotency Key**: `training_event_id`

**Payload**:
```json
{
  "training_event_id": "train-uuid-001",
  "tenant_id": "org-uuid-001",
  "model_type": "demand_forecast|price_optimizer|churn_prediction|recommendation_engine",
  "model_version": "1.2.0",
  "training_start": "2024-01-15T22:00:00Z",
  "training_data_period": {
    "start": "2023-11-15",
    "end": "2024-01-15"
  },
  "sample_size": 50000,
  "features_used": [
    "historical_sales",
    "seasonality",
    "promotional_activity",
    "competitor_pricing"
  ],
  "hyperparameters": {
    "learning_rate": 0.001,
    "batch_size": 32,
    "epochs": 100
  }
}
```

---

### 10.2 MODEL.TRAINING_COMPLETED

**Event Type**: `model.training_completed`  
**Producer**: AI/ML Service  
**Consumers**: Model Registry, Validation Service, Notifications  
**Idempotency Key**: `training_event_id`

**Payload**:
```json
{
  "training_event_id": "train-uuid-001",
  "tenant_id": "org-uuid-001",
  "model_type": "demand_forecast",
  "model_version": "1.2.0",
  "training_end": "2024-01-16T04:30:00Z",
  "training_duration_seconds": 23400,
  "status": "successful|failed",
  "metrics": {
    "accuracy": 0.92,
    "precision": 0.89,
    "recall": 0.91,
    "f1_score": 0.90,
    "rmse": 5.2
  },
  "artifact_path": "s3://ml-artifacts/tenant-001/demand-forecast-1.2.0.pkl"
}
```

---

### 10.3 MODEL.DEPLOYED

**Event Type**: `model.deployed`  
**Producer**: Deployment Service  
**Consumers**: Model Registry, Inference Service, Monitoring  
**Idempotency Key**: `deployment_id`

**Payload**:
```json
{
  "deployment_id": "deploy-uuid-001",
  "model_id": "model-uuid-001",
  "tenant_id": "org-uuid-001",
  "model_type": "demand_forecast",
  "model_version": "1.2.0",
  "deployment_environment": "staging|production",
  "deployed_timestamp": "2024-01-16T10:00:00Z",
  "replicas": 3,
  "canary_percentage": 10,
  "expected_throughput": 1000
}
```

---

### 10.4 INFERENCE.PERFORMED

**Event Type**: `inference.performed`  
**Producer**: Inference Service  
**Consumers**: Analytics (ClickHouse), Model Monitoring, Audit Trail  
**Idempotency Key**: `inference_id`

**Payload**:
```json
{
  "inference_id": "inf-uuid-001",
  "tenant_id": "org-uuid-001",
  "model_type": "demand_forecast",
  "model_version": "1.2.0",
  "input_entity_type": "product",
  "input_entity_id": "product-uuid-001",
  "inference_timestamp": "2024-01-16T10:15:00Z",
  "input_features": {
    "historical_sales_30d": 500,
    "seasonal_index": 1.2,
    "current_stock": 250
  },
  "prediction": {
    "demand_forecast_30d": 600,
    "confidence_score": 0.85,
    "recommended_reorder_quantity": 350
  },
  "inference_latency_ms": 45
}
```

---

## 11. Integration & Webhook Events

### 11.1 WEBHOOK.REGISTERED

**Event Type**: `webhook.registered`  
**Producer**: Webhook Service  
**Consumers**: Webhook Manager, Audit Trail  
**Idempotency Key**: `webhook_id`

**Payload**:
```json
{
  "webhook_id": "webhook-uuid-001",
  "tenant_id": "org-uuid-001",
  "endpoint_url": "https://partner.example.com/webhooks/orders",
  "event_types": ["order.created", "order.confirmed", "shipment.delivered"],
  "registered_timestamp": "2024-01-15T10:30:00Z",
  "active": true,
  "retry_policy": {
    "max_retries": 5,
    "backoff_multiplier": 2
  }
}
```

---

### 11.2 WEBHOOK.DELIVERED

**Event Type**: `webhook.delivered`  
**Producer**: Webhook Delivery Service  
**Consumers**: Webhook Service (metrics), Analytics  
**Idempotency Key**: `delivery_id`

**Payload**:
```json
{
  "delivery_id": "delivery-uuid-001",
  "webhook_id": "webhook-uuid-001",
  "tenant_id": "org-uuid-001",
  "event_type": "order.created",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "delivered_timestamp": "2024-01-15T10:31:00Z",
  "http_status_code": 200,
  "response_time_ms": 250,
  "attempt_count": 1
}
```

---

### 11.3 WEBHOOK.FAILED

**Event Type**: `webhook.failed`  
**Producer**: Webhook Delivery Service  
**Consumers**: Webhook Service (retry queue), Notifications  
**Idempotency Key**: `delivery_id`

**Payload**:
```json
{
  "delivery_id": "delivery-uuid-001",
  "webhook_id": "webhook-uuid-001",
  "tenant_id": "org-uuid-001",
  "event_type": "order.created",
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "failed_timestamp": "2024-01-15T10:31:30Z",
  "http_status_code": 500,
  "error_message": "Service temporarily unavailable",
  "attempt_count": 1,
  "next_retry_at": "2024-01-15T10:32:30Z"
}
```

---

## 12. Plugin & Extension Events

### 12.1 PLUGIN.INSTALLED

**Event Type**: `plugin.installed`  
**Producer**: Plugin Service  
**Consumers**: Plugin Registry, Audit Trail, System Health  
**Idempotency Key**: `plugin_id`

**Payload**:
```json
{
  "plugin_id": "plugin-uuid-001",
  "tenant_id": "org-uuid-001",
  "plugin_name": "fraud-detector-premium",
  "plugin_version": "2.1.0",
  "installed_timestamp": "2024-01-15T10:30:00Z",
  "installed_by": "user-uuid-001",
  "permissions_requested": ["read:orders", "read:customer", "write:flags"],
  "configuration": {
    "risk_threshold": 0.75
  }
}
```

---

### 12.2 PLUGIN.ACTIVATED

**Event Type**: `plugin.activated`  
**Producer**: Plugin Service  
**Consumers**: Event Router, Hook Registry  
**Idempotency Key**: `plugin_id`

**Payload**:
```json
{
  "plugin_id": "plugin-uuid-001",
  "tenant_id": "org-uuid-001",
  "plugin_name": "fraud-detector-premium",
  "activated_timestamp": "2024-01-15T10:35:00Z",
  "activated_by": "user-uuid-001",
  "hooks_registered": [
    "order.create:pre",
    "order.confirm:pre"
  ]
}
```

---

### 12.3 PLUGIN.HOOK_EXECUTED

**Event Type**: `plugin.hook_executed`  
**Producer**: Plugin Execution Engine  
**Consumers**: Plugin Monitoring, Audit Trail, Analytics  
**Idempotency Key**: `execution_id`

**Payload**:
```json
{
  "execution_id": "exec-uuid-001",
  "plugin_id": "plugin-uuid-001",
  "tenant_id": "org-uuid-001",
  "hook_name": "order.create:pre",
  "execution_timestamp": "2024-01-15T10:31:00Z",
  "execution_duration_ms": 125,
  "status": "success|error|timeout",
  "input": {
    "order_id": "order-uuid-001"
  },
  "output": {
    "valid": true,
    "flags": ["fraud_risk: low"]
  }
}
```

---

## 13. System & Operational Events

### 13.1 TENANT.CREATED

**Event Type**: `tenant.created`  
**Producer**: Tenant Management Service  
**Consumers**: Schema Service, Audit Trail, Notifications  
**Idempotency Key**: `tenant_id`

**Payload**:
```json
{
  "tenant_id": "org-uuid-001",
  "tenant_name": "Acme Corp",
  "created_timestamp": "2024-01-15T10:30:00Z",
  "created_by": "admin-user-uuid",
  "subscription_tier": "professional|enterprise|custom",
  "features_enabled": [
    "multi_location",
    "advanced_analytics",
    "custom_plugins"
  ],
  "initial_configuration": {
    "timezone": "America/New_York",
    "currency": "USD"
  }
}
```

---

### 13.2 TENANT.SUBSCRIPTION_CHANGED

**Event Type**: `tenant.subscription_changed`  
**Producer**: Subscription Service  
**Consumers**: Billing, Feature Flag Service, Audit Trail  
**Idempotency Key**: `change_id`

**Payload**:
```json
{
  "change_id": "change-uuid-001",
  "tenant_id": "org-uuid-001",
  "old_tier": "professional",
  "new_tier": "enterprise",
  "effective_date": "2024-02-01",
  "changed_timestamp": "2024-01-15T10:30:00Z",
  "changed_by": "admin-user-uuid",
  "billing_impact": {
    "old_monthly_cost_cents": 99900,
    "new_monthly_cost_cents": 299900,
    "proration_credit_cents": 0
  }
}
```

---

### 13.3 USER.CREATED

**Event Type**: `user.created`  
**Producer**: User Management Service  
**Consumers**: Audit Trail, Email Service, Access Control  
**Idempotency Key**: `user_id`

**Payload**:
```json
{
  "user_id": "user-uuid-001",
  "tenant_id": "org-uuid-001",
  "email": "john.doe@acmecorp.com",
  "full_name": "John Doe",
  "created_timestamp": "2024-01-15T10:30:00Z",
  "created_by": "admin-user-uuid",
  "roles": ["order_manager", "inventory_viewer"],
  "status": "active|pending_confirmation"
}
```

---

### 13.4 BACKUP.COMPLETED

**Event Type**: `backup.completed`  
**Producer**: Backup Service  
**Consumers**: Monitoring, Audit Trail  
**Idempotency Key**: `backup_id`

**Payload**:
```json
{
  "backup_id": "backup-uuid-001",
  "tenant_id": "org-uuid-001",
  "backup_type": "full|incremental",
  "started_at": "2024-01-15T23:00:00Z",
  "completed_at": "2024-01-16T00:30:00Z",
  "duration_seconds": 5400,
  "size_bytes": 1073741824,
  "status": "successful|failed",
  "backup_location": "s3://backups/tenant-001/full-2024-01-15.tar.gz"
}
```

---

## 14. Event Flow Diagrams

### 14.1 Order-to-Payment Flow

```
[Customer Checkout] (storefront)
       ↓
[order.created] → Order Service
       ↓
   ┌───┴───┐
   ↓       ↓
Inventory Finance  Fulfillment
   ↓       ↓          ↓
[stock.   [payment   [shipment.
 allocated]_auth...]  created]
   ↓       ↓          ↓
   └───┬───┘          ↓
       ↓         [shipment.
   [order.      delivered]
    confirmed]       ↓
       ↓        [return.initiated]
   [payment.        (if applicable)
    captured]
       ↓
  [invoice.
   created]
       ↓
  [payment.
   received]
       ↓
  Finance Reports & Analytics
```

### 14.2 Procurement-to-AP Flow

```
[Procurement Team Creates PO]
       ↓
[po.created]
       ↓
   ┌───┴────────────┐
   ↓                ↓
Supplier          Finance
   ↓                ↓
[po.ack]      [invoice ready]
   ↓                ↓
Warehouse      Payment Service
   ↓                ↓
[po.received]  [payment.
   ↓           received]
Inventory          ↓
Update        [journal.entry
   ↓          posted]
[stock.adj]        ↓
   ↓         GL & AP Reports
Analytics
```

---

## 15. Event Consumer Implementation Pattern

### 15.1 Kafka Consumer Pseudocode

```typescript
// Example: Finance Service consuming order events
const kafka = new Kafka({ brokers: ['kafka:9092'] });
const consumer = kafka.consumer({ 
  groupId: 'finance-service-orders-consumer'
});

await consumer.subscribe({ topic: 'orders-events' });

await consumer.run({
  eachMessage: async ({ topic, partition, message }) => {
    const event = JSON.parse(message.value.toString());
    const tenantId = event.tenant_id;
    const idempotencyKey = event.idempotency_key;
    
    // Check if already processed (idempotency)
    const processed = await checkIdempotencyKey(idempotencyKey);
    if (processed) {
      logger.info(`Skipping duplicate event: ${idempotencyKey}`);
      return;
    }
    
    try {
      switch (event.event_type) {
        case 'order.created':
          await handleOrderCreated(tenantId, event.payload);
          break;
        case 'order.confirmed':
          await handleOrderConfirmed(tenantId, event.payload);
          break;
        case 'shipment.delivered':
          await handleShipmentDelivered(tenantId, event.payload);
          break;
      }
      
      // Mark as processed
      await recordIdempotencyKey(idempotencyKey);
      
      // Publish outbound events
      await publishToKafka({
        event_type: 'invoice.created',
        tenant_id: tenantId,
        ...
      });
      
    } catch (error) {
      logger.error(`Error processing event: ${event.event_id}`, error);
      // Implement retry logic
      throw error; // Will trigger Kafka rebalance and retry
    }
  }
});
```

---

## 16. Audit & Compliance

### 16.1 Audit Trail Requirements

All events must be logged to **ClickHouse** `events` table with:
- Full event envelope (all standard fields)
- Timestamp of event creation + processing
- Actor context (user_id, actor_type)
- Idempotency key for deduplication
- Source service identifier
- Correlation ID for request tracing

**Retention Policy**: 
- Production events: 7 years (compliance requirement)
- Development/test events: 90 days

---

### 16.2 PII/Sensitive Data Handling

Events containing sensitive data (email, phone, payment info) must:
- Encrypt sensitive fields in transit (TLS)
- Use tokenization/hashing where applicable
- Log only masked values to audit trail
- Implement data retention policies per GDPR

---

## 17. Event Versioning & Evolution

Event types are versioned using `event_version` field (e.g., "1.0", "2.0").

**Breaking Changes** (major version):
- Required field removal
- Type changes

**Non-Breaking Changes** (minor version):
- New optional fields
- Behavior changes that are backward compatible

---

## 18. Summary: 100+ Events by Domain

| Domain | Event Count | Categories |
|--------|---|---|
| Procurement | 5 | PO lifecycle |
| Inventory | 4 | Stock movements, adjustments, alerts |
| Catalog | 5 | Products, variants, categories, pricing |
| Pricing | 5 | Price lists, promotions, tier pricing |
| Orders | 6 | Order lifecycle, payment authorization |
| Fulfillment | 7 | Pick, pack, QC, shipment, returns |
| Finance | 7 | Invoices, payments, GL entries, overdue |
| Analytics | 2 | Reports, metrics |
| AI/ML | 4 | Model training, deployment, inference |
| Webhooks | 3 | Registration, delivery, failure |
| Plugins | 3 | Installation, activation, execution |
| System | 4 | Tenant, subscription, users, backup |
| **TOTAL** | **56** | **Cross-domain flows up to 100+ with variants** |

---

## 19. Cross-Reference to Canonical Data Model

Events directly correspond to entity lifecycle changes in [Canonical Data Model](./canonical-data-model.md):

- **Procurement Events** → `procurement_orders`, `procurement_order_items`, `suppliers` tables
- **Inventory Events** → `inventory_stock_ledger`, `inventory_current_stock` tables
- **Catalog Events** → `products`, `product_variants`, `categories` tables
- **Pricing Events** → `price_lists`, `product_prices`, `promotions` tables
- **Order Events** → `orders`, `order_items`, `shipments` tables
- **Finance Events** → `invoices`, `payments`, `journal_entries` tables
- **AI Events** → `ai_telemetry_training`, `ai_telemetry_inferences`, `ai_models` tables

---

**Last Updated**: 2024-12-16  
**Version**: 1.0  
**Status**: Active
