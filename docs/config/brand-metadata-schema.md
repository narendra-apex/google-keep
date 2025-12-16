# Brand Metadata & Configuration Schema

## Executive Summary

This document defines the JSON Schema for brand-level configuration in the Unified Commerce OS, covering themes, workflows, feature flags, channels, plugin hooks, and runtime overrides. All configuration is stored in PostgreSQL JSONB fields and can be deployed as code (configuration-as-code) or managed via Admin Portal UI.

**Key Principles**:
- **Configuration Over Code**: Behavior customization without redeployment
- **Multi-Tenant Isolation**: Each brand's config is isolated by `tenant_id` + `brand_id`
- **Schema Versioning**: All schemas include `schema_version` for safe evolution
- **Audit Trail**: All configuration changes are logged with actor context
- **Hot Reload**: Some configurations support runtime updates without restart

---

## 1. Brand Metadata Structure

### 1.1 Core Brand Record

Every brand in the system has a root configuration object:

```json
{
  "tenant_id": "org-uuid-001",
  "brand_id": "brand-uuid-001",
  "name": "Acme Corp Retail",
  "legal_name": "Acme Corporation Inc.",
  "settings": {
    "schema_version": "1.0.0",
    "theme": {},
    "workflows": {},
    "feature_flags": {},
    "channels": {},
    "plugin_hooks": {},
    "runtime_overrides": {}
  },
  "metadata": {
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "updated_by": "admin-uuid-001"
  }
}
```

**Related Events**:
- On brand creation: `tenant.created` event published
- On config update: Webhook notifications if registered for `brand.config_updated` events

---

## 2. Theme Configuration Schema

### 2.1 Theme Object

Defines visual branding for storefront and admin portal.

```json
{
  "schema_version": "1.0.0",
  "enabled": true,
  "primary_theme": {
    "name": "corporate_blue",
    "colors": {
      "primary": "#0066CC",
      "secondary": "#FF9900",
      "accent": "#00AA44",
      "background": "#FFFFFF",
      "text": "#333333",
      "success": "#00AA44",
      "warning": "#FFAA00",
      "error": "#CC0000"
    },
    "typography": {
      "heading_font": "Inter",
      "body_font": "Inter",
      "heading_size_px": 32,
      "body_size_px": 14,
      "line_height": 1.5
    },
    "spacing": {
      "base_unit_px": 8,
      "border_radius_px": 4
    }
  },
  "branding": {
    "logo_url": "https://cdn.example.com/logo.png",
    "logo_alt_text": "Acme Corp Logo",
    "favicon_url": "https://cdn.example.com/favicon.ico",
    "banner_url": "https://cdn.example.com/banner.jpg",
    "banner_alt_text": "Spring Sale Banner"
  },
  "storefront": {
    "logo_position": "top_left",
    "header_style": "sticky",
    "footer_layout": "multi_column",
    "product_image_display": "carousel",
    "product_video_enabled": true,
    "show_reviews": true,
    "show_related_products": true,
    "show_recommended_products": true
  },
  "admin_portal": {
    "sidebar_collapsed_default": false,
    "theme_mode": "light",
    "custom_css_url": "https://cdn.example.com/custom-admin.css"
  }
}
```

### 2.2 JSON Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Theme Configuration",
  "required": ["schema_version", "enabled"],
  "properties": {
    "schema_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$",
      "description": "Schema version (semantic versioning)"
    },
    "enabled": {
      "type": "boolean",
      "default": true
    },
    "primary_theme": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "enum": ["corporate_blue", "modern_minimal", "warm_sunset", "custom"]
        },
        "colors": {
          "type": "object",
          "properties": {
            "primary": { "type": "string", "pattern": "^#[0-9A-F]{6}$" },
            "secondary": { "type": "string", "pattern": "^#[0-9A-F]{6}$" },
            "accent": { "type": "string", "pattern": "^#[0-9A-F]{6}$" },
            "background": { "type": "string", "pattern": "^#[0-9A-F]{6}$" },
            "text": { "type": "string", "pattern": "^#[0-9A-F]{6}$" },
            "success": { "type": "string", "pattern": "^#[0-9A-F]{6}$" },
            "warning": { "type": "string", "pattern": "^#[0-9A-F]{6}$" },
            "error": { "type": "string", "pattern": "^#[0-9A-F]{6}$" }
          }
        },
        "typography": {
          "type": "object",
          "properties": {
            "heading_font": { "type": "string" },
            "body_font": { "type": "string" },
            "heading_size_px": { "type": "integer", "minimum": 12, "maximum": 96 },
            "body_size_px": { "type": "integer", "minimum": 10, "maximum": 32 },
            "line_height": { "type": "number", "minimum": 1.0, "maximum": 3.0 }
          }
        }
      }
    },
    "branding": {
      "type": "object",
      "properties": {
        "logo_url": { "type": "string", "format": "uri" },
        "logo_alt_text": { "type": "string" },
        "favicon_url": { "type": "string", "format": "uri" }
      }
    }
  }
}
```

---

## 3. Workflow Configuration Schema

### 3.1 Workflow Definition

Workflows define multi-step business processes (order fulfillment, PO approval, etc.).

```json
{
  "schema_version": "1.0.0",
  "workflows": {
    "order_fulfillment": {
      "enabled": true,
      "steps": [
        {
          "step_id": "payment_check",
          "name": "Payment Verification",
          "type": "condition",
          "description": "Verify payment before fulfillment",
          "condition": {
            "field": "payment_status",
            "operator": "equals",
            "value": "captured"
          },
          "on_success": "inventory_allocation",
          "on_failure": "payment_failed",
          "timeout_minutes": 30
        },
        {
          "step_id": "inventory_allocation",
          "name": "Allocate Inventory",
          "type": "action",
          "description": "Reserve inventory for order",
          "action": "inventory.allocate",
          "parameters": {
            "strategy": "fifo",
            "prefer_location": "nearest"
          },
          "on_success": "pick_assignment",
          "on_failure": "stock_unavailable",
          "timeout_minutes": 60,
          "retry_policy": {
            "max_retries": 3,
            "backoff_multiplier": 2,
            "backoff_initial_seconds": 5
          }
        },
        {
          "step_id": "pick_assignment",
          "name": "Assign Pick Task",
          "type": "action",
          "action": "fulfillment.assign_pick",
          "on_success": "wait_completion",
          "on_failure": "pickup_failed",
          "timeout_minutes": 240
        },
        {
          "step_id": "wait_completion",
          "name": "Wait for Picking",
          "type": "wait_event",
          "wait_for_event": "pick_task.completed",
          "timeout_minutes": 480,
          "on_success": "quality_check",
          "on_failure": "pickup_timeout"
        },
        {
          "step_id": "quality_check",
          "name": "Quality Control",
          "type": "action",
          "action": "fulfillment.qc_check",
          "on_success": "create_shipment",
          "on_failure": "qc_failed",
          "timeout_minutes": 120
        },
        {
          "step_id": "create_shipment",
          "name": "Create Shipment",
          "type": "action",
          "action": "fulfillment.create_shipment",
          "on_success": "end",
          "on_failure": "shipment_creation_failed"
        }
      ],
      "error_handlers": [
        {
          "error_step": "payment_failed",
          "name": "Payment Failed Handler",
          "actions": [
            {
              "type": "notify",
              "recipient": "customer",
              "template": "payment_failed_email"
            },
            {
              "type": "transition",
              "next_step": "retry_payment"
            }
          ]
        },
        {
          "error_step": "stock_unavailable",
          "name": "Stock Unavailable Handler",
          "actions": [
            {
              "type": "notify",
              "recipient": "customer",
              "template": "backorder_email"
            },
            {
              "type": "wait_event",
              "wait_for_event": "inventory.stock_available",
              "timeout_minutes": 10080
            }
          ]
        }
      ]
    },
    "po_approval": {
      "enabled": true,
      "steps": [
        {
          "step_id": "create_po",
          "name": "Create PO",
          "type": "start"
        },
        {
          "step_id": "budget_check",
          "name": "Check Budget",
          "type": "condition",
          "condition": {
            "field": "total_amount_cents",
            "operator": "less_than",
            "value": "500000"
          },
          "on_success": "auto_approve",
          "on_failure": "require_approval"
        },
        {
          "step_id": "auto_approve",
          "name": "Auto-Approve Small Orders",
          "type": "action",
          "action": "procurement.approve"
        },
        {
          "step_id": "require_approval",
          "name": "Wait for Manager Approval",
          "type": "wait_event",
          "wait_for_event": "po.manual_approval",
          "timeout_minutes": 1440
        }
      ]
    }
  }
}
```

### 3.2 Workflow Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Workflow Configuration",
  "required": ["schema_version"],
  "properties": {
    "schema_version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "workflows": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["enabled", "steps"],
        "properties": {
          "enabled": { "type": "boolean" },
          "steps": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["step_id", "name", "type"],
              "properties": {
                "step_id": { "type": "string", "pattern": "^[a-z_]+$" },
                "name": { "type": "string" },
                "type": {
                  "type": "string",
                  "enum": ["start", "end", "action", "condition", "wait_event", "parallel", "error_handler"]
                },
                "description": { "type": "string" },
                "action": { "type": "string" },
                "condition": { "type": "object" },
                "on_success": { "type": "string" },
                "on_failure": { "type": "string" },
                "timeout_minutes": { "type": "integer", "minimum": 1 },
                "retry_policy": { "type": "object" }
              }
            }
          },
          "error_handlers": {
            "type": "array",
            "items": { "type": "object" }
          }
        }
      }
    }
  }
}
```

**Related Events**:
- Step execution triggers domain events (e.g., `pick_task.assigned`, `shipment.created`)
- Workflow state transitions generate `workflow.step_completed` events
- See Event Catalog for full list of triggerable events

---

## 4. Feature Flags Configuration

### 4.1 Feature Flags Object

Enables/disables features at runtime without redeployment.

```json
{
  "schema_version": "1.0.0",
  "flags": {
    "catalog": {
      "product_reviews_enabled": {
        "enabled": true,
        "rollout_percentage": 100,
        "description": "Allow customers to submit product reviews",
        "started_at": "2024-01-01T00:00:00Z",
        "ended_at": null
      },
      "ai_recommendations": {
        "enabled": true,
        "rollout_percentage": 50,
        "description": "Show AI-powered product recommendations",
        "target_segments": ["loyal_customers", "high_value"],
        "ab_test": {
          "enabled": true,
          "control_group_size": 0.5,
          "variant_a": "old_algorithm",
          "variant_b": "new_ml_model"
        }
      },
      "dynamic_pricing": {
        "enabled": false,
        "rollout_percentage": 0,
        "description": "Enable demand-based price adjustments",
        "scheduled_rollout": {
          "start_date": "2024-02-01",
          "rollout_increments": [10, 25, 50, 100],
          "increment_duration_days": 7
        }
      }
    },
    "order_management": {
      "express_checkout": {
        "enabled": true,
        "rollout_percentage": 100,
        "description": "One-click checkout for returning customers"
      },
      "buy_now_pay_later": {
        "enabled": true,
        "rollout_percentage": 75,
        "description": "BNPL payment option",
        "provider": "klarna",
        "min_order_cents": 5000,
        "max_order_cents": 500000
      },
      "subscription_orders": {
        "enabled": false,
        "rollout_percentage": 0,
        "description": "Allow customers to subscribe to recurring orders"
      }
    },
    "fulfillment": {
      "same_day_delivery": {
        "enabled": true,
        "rollout_percentage": 100,
        "enabled_locations": ["location-uuid-001", "location-uuid-002"],
        "description": "Offer same-day delivery option"
      },
      "split_shipments": {
        "enabled": true,
        "rollout_percentage": 100,
        "description": "Allow orders to be split across multiple shipments"
      }
    },
    "analytics": {
      "advanced_reporting": {
        "enabled": true,
        "rollout_percentage": 100,
        "description": "Advanced analytics dashboard",
        "required_tier": "professional"
      },
      "predictive_analytics": {
        "enabled": false,
        "rollout_percentage": 0,
        "description": "AI-powered demand forecasting",
        "required_tier": "enterprise"
      }
    }
  },
  "metadata": {
    "last_updated": "2024-01-15T10:30:00Z",
    "updated_by": "admin-uuid-001",
    "change_log": [
      {
        "timestamp": "2024-01-15T10:30:00Z",
        "flag_name": "ai_recommendations",
        "change": "rollout_percentage changed from 25 to 50",
        "reason": "Performance metrics positive"
      }
    ]
  }
}
```

### 4.2 Feature Flag Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Feature Flags Configuration",
  "required": ["schema_version", "flags"],
  "properties": {
    "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "flags": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "additionalProperties": {
          "type": "object",
          "required": ["enabled"],
          "properties": {
            "enabled": { "type": "boolean" },
            "rollout_percentage": {
              "type": "integer",
              "minimum": 0,
              "maximum": 100
            },
            "description": { "type": "string" },
            "target_segments": {
              "type": "array",
              "items": { "type": "string" }
            },
            "enabled_locations": {
              "type": "array",
              "items": { "type": "string", "format": "uuid" }
            },
            "required_tier": {
              "type": "string",
              "enum": ["free", "starter", "professional", "enterprise"]
            },
            "ab_test": { "type": "object" },
            "scheduled_rollout": { "type": "object" }
          }
        }
      }
    }
  }
}
```

---

## 5. Channels Configuration

### 5.1 Channels Object

Defines all sales channels (storefront, marketplaces, mobile, etc.).

```json
{
  "schema_version": "1.0.0",
  "channels": {
    "primary_storefront": {
      "channel_id": "channel-uuid-001",
      "type": "storefront",
      "name": "Main Storefront",
      "status": "active",
      "domain": "store.acmecorp.com",
      "settings": {
        "theme_id": "theme-001",
        "currency": "USD",
        "language": "en",
        "timezone": "America/New_York",
        "checkout_flow": "express",
        "payment_gateways": ["stripe", "paypal"],
        "shipping_providers": ["fedex", "ups", "usps"]
      },
      "inventory_sync": {
        "enabled": true,
        "sync_interval_minutes": 5,
        "fallback_to_cache_if_unavailable": true
      },
      "order_sync": {
        "enabled": true,
        "import_enabled": true,
        "export_enabled": true
      }
    },
    "amazon_channel": {
      "channel_id": "channel-uuid-002",
      "type": "marketplace",
      "name": "Amazon Seller Central",
      "status": "active",
      "marketplace_id": "ATVPDKIKX0DER",
      "seller_id": "A1SELLER2024",
      "settings": {
        "sync_schedule": "every_6_hours",
        "repricing_strategy": "competitive"
      },
      "inventory_sync": {
        "enabled": true,
        "inventory_location": "location-uuid-001",
        "buffer_quantity": 10
      },
      "credentials": {
        "access_key": "encrypted-key",
        "secret_key": "encrypted-secret"
      }
    },
    "shopify_store": {
      "channel_id": "channel-uuid-003",
      "type": "storefront",
      "name": "Shopify Store",
      "status": "active",
      "external_id": "shopify-store-123",
      "settings": {
        "api_version": "2024-01"
      },
      "inventory_sync": {
        "enabled": true,
        "sync_interval_minutes": 15
      }
    },
    "mobile_app": {
      "channel_id": "channel-uuid-004",
      "type": "mobile",
      "name": "iOS/Android App",
      "status": "active",
      "settings": {
        "api_endpoint": "https://api.example.com/v1/mobile",
        "min_app_version": "1.0.0",
        "feature_flags": ["push_notifications", "biometric_login"]
      }
    },
    "b2b_portal": {
      "channel_id": "channel-uuid-005",
      "type": "wholesale",
      "name": "B2B Wholesale Portal",
      "status": "active",
      "domain": "wholesale.acmecorp.com",
      "settings": {
        "bulk_order_enabled": true,
        "minimum_order_value_cents": 50000,
        "custom_pricing": true,
        "require_approval": true
      }
    }
  }
}
```

### 5.2 Channels Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Channels Configuration",
  "required": ["schema_version", "channels"],
  "properties": {
    "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "channels": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["channel_id", "type", "name", "status"],
        "properties": {
          "channel_id": { "type": "string", "format": "uuid" },
          "type": {
            "type": "string",
            "enum": ["storefront", "marketplace", "mobile", "social", "wholesale", "api"]
          },
          "name": { "type": "string" },
          "status": { "type": "string", "enum": ["active", "inactive", "archived"] },
          "domain": { "type": "string", "format": "uri" },
          "marketplace_id": { "type": "string" },
          "settings": { "type": "object" },
          "inventory_sync": { "type": "object" },
          "order_sync": { "type": "object" }
        }
      }
    }
  }
}
```

---

## 6. Plugin Hooks Configuration

### 6.1 Plugin Hooks Object

Defines integration points for third-party plugins and extensions.

```json
{
  "schema_version": "1.0.0",
  "plugin_hooks": {
    "order_creation_pre": {
      "enabled": true,
      "hooks": [
        {
          "hook_id": "hook-001",
          "plugin_id": "fraud-detector-plugin",
          "plugin_name": "Fraud Detection Premium",
          "priority": 100,
          "enabled": true,
          "timeout_seconds": 5,
          "on_timeout": "continue",
          "config": {
            "risk_threshold": 0.75,
            "check_velocity": true,
            "check_geographic": true
          }
        },
        {
          "hook_id": "hook-002",
          "plugin_id": "loyalty-points-plugin",
          "plugin_name": "Loyalty Points Calculator",
          "priority": 50,
          "enabled": true,
          "timeout_seconds": 3,
          "on_timeout": "skip",
          "config": {
            "points_per_dollar": 1.0,
            "vip_multiplier": 2.0
          }
        }
      ]
    },
    "order_confirmation_post": {
      "enabled": true,
      "hooks": [
        {
          "hook_id": "hook-003",
          "plugin_id": "email-notification-plugin",
          "plugin_name": "Email Notifications",
          "priority": 100,
          "enabled": true,
          "config": {
            "send_confirmation": true,
            "template": "order_confirmation_v2"
          }
        }
      ]
    },
    "product_price_update_pre": {
      "enabled": true,
      "hooks": [
        {
          "hook_id": "hook-004",
          "plugin_id": "dynamic-pricing-plugin",
          "plugin_name": "Dynamic Pricing Engine",
          "priority": 100,
          "enabled": false,
          "config": {
            "algorithm": "demand_based",
            "max_price_change_percent": 20
          }
        }
      ]
    },
    "inventory_adjustment_post": {
      "enabled": true,
      "hooks": [
        {
          "hook_id": "hook-005",
          "plugin_id": "analytics-plugin",
          "plugin_name": "Real-time Analytics",
          "priority": 50,
          "enabled": true,
          "config": {
            "send_to_warehouse": "analytics-stream"
          }
        }
      ]
    }
  }
}
```

### 6.2 Plugin Hooks Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Plugin Hooks Configuration",
  "required": ["schema_version", "plugin_hooks"],
  "properties": {
    "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "plugin_hooks": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["enabled", "hooks"],
        "properties": {
          "enabled": { "type": "boolean" },
          "hooks": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["hook_id", "plugin_id", "priority"],
              "properties": {
                "hook_id": { "type": "string", "pattern": "^hook-[a-z0-9]+$" },
                "plugin_id": { "type": "string" },
                "plugin_name": { "type": "string" },
                "priority": { "type": "integer", "minimum": 0, "maximum": 1000 },
                "enabled": { "type": "boolean" },
                "timeout_seconds": { "type": "integer", "minimum": 1 },
                "on_timeout": { "type": "string", "enum": ["continue", "skip", "fail"] },
                "config": { "type": "object" }
              }
            }
          }
        }
      }
    }
  }
}
```

**Related Events**:
- `plugin.installed` - When plugin hooks are registered
- `plugin.activated` - When hooks are enabled
- `plugin.hook_executed` - After each hook execution

---

## 7. Runtime Overrides

### 7.1 Runtime Overrides Object

Temporary or permanent overrides for system behavior (e.g., disable features, set maintenance mode).

```json
{
  "schema_version": "1.0.0",
  "runtime_overrides": {
    "maintenance_mode": {
      "enabled": false,
      "reason": "Database maintenance",
      "scheduled_end_at": null,
      "allowed_ips": [],
      "show_maintenance_page": true
    },
    "payment_processing": {
      "disabled_gateways": [],
      "disabled_methods": [],
      "fallback_to_offline": false,
      "note": null
    },
    "inventory_behavior": {
      "allow_overselling": false,
      "low_stock_threshold": 10,
      "hide_low_stock_products": false
    },
    "fulfillment": {
      "pause_all_shipping": false,
      "enabled_carriers": ["fedex", "ups", "usps"],
      "disabled_carriers": []
    },
    "api_rate_limits": {
      "enabled": true,
      "requests_per_minute": 300,
      "burst_allowance": 50
    },
    "data_export": {
      "enabled": true,
      "max_export_rows": 100000,
      "require_approval_over_rows": 50000
    }
  }
}
```

### 7.2 Runtime Overrides Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Runtime Overrides Configuration",
  "required": ["schema_version", "runtime_overrides"],
  "properties": {
    "schema_version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "runtime_overrides": {
      "type": "object",
      "properties": {
        "maintenance_mode": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean" },
            "reason": { "type": "string" },
            "scheduled_end_at": { "type": ["string", "null"], "format": "date-time" },
            "allowed_ips": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        },
        "payment_processing": {
          "type": "object",
          "properties": {
            "disabled_gateways": { "type": "array", "items": { "type": "string" } },
            "disabled_methods": { "type": "array", "items": { "type": "string" } }
          }
        },
        "inventory_behavior": {
          "type": "object",
          "properties": {
            "allow_overselling": { "type": "boolean" },
            "low_stock_threshold": { "type": "integer", "minimum": 0 }
          }
        }
      }
    }
  }
}
```

---

## 8. Multi-Tenancy Enforcement Patterns

### 8.1 Tenant-Aware Routing

All configuration endpoints enforce tenant isolation:

```typescript
// Middleware example
app.use(async (c, next) => {
  const tenantId = c.req.header('x-tenant-id') || extractFromJWT(...);
  const brandId = c.req.header('x-brand-id') || extractFromJWT(...);
  
  // Set context for RLS
  c.set('tenant', { id: tenantId, brand_id: brandId, user_id: ... });
  
  // Validate tenant access
  const hasAccess = await validateTenantAccess(tenantId, userId);
  if (!hasAccess) {
    throw new ForbiddenError('Tenant access denied');
  }
  
  await next();
});
```

### 8.2 Row-Level Security (RLS) Policies

Configuration records are isolated by tenant + brand:

```sql
-- RLS Policy for brand_metadata table
CREATE POLICY brand_metadata_tenant_isolation ON brand_metadata
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Set tenant context before query
SET app.current_tenant_id = 'org-uuid-001';

-- Query now returns only tenant's config
SELECT * FROM brand_metadata WHERE brand_id = 'brand-uuid-001';
```

### 8.3 Configuration Endpoints with RLS

All configuration API endpoints reference the event catalog:

| Endpoint | Method | Related Event | RLS Enforcement |
|----------|--------|---------------|-----------------|
| `POST /brands/{brand_id}/config` | POST | brand configuration created | tenant_id match |
| `GET /brands/{brand_id}/config` | GET | - | tenant_id match |
| `PATCH /brands/{brand_id}/config/theme` | PATCH | - | tenant_id match |
| `PATCH /brands/{brand_id}/config/workflows` | PATCH | workflow configuration updated | tenant_id match |
| `PATCH /brands/{brand_id}/config/feature-flags` | PATCH | - | tenant_id match |
| `POST /brands/{brand_id}/config/audit-log` | GET | - | tenant_id match |

### 8.4 Audit Trail for Configuration Changes

All config changes are logged:

```json
{
  "audit_id": "audit-uuid-001",
  "tenant_id": "org-uuid-001",
  "brand_id": "brand-uuid-001",
  "timestamp": "2024-01-15T10:30:00Z",
  "actor_id": "admin-uuid-001",
  "action": "config_updated",
  "resource_type": "brand_config",
  "resource_id": "config-uuid-001",
  "change_summary": "Updated theme colors and feature flags",
  "changes": [
    {
      "path": "settings.theme.colors.primary",
      "old_value": "#0066CC",
      "new_value": "#0077DD"
    },
    {
      "path": "settings.feature_flags.ai_recommendations.enabled",
      "old_value": false,
      "new_value": true
    }
  ]
}
```

---

## 9. Configuration Management API

### 9.1 Configuration Endpoints

```yaml
GET /brands/{brand_id}/config
  Description: Retrieve full brand configuration
  Related Event: None (read-only)
  RLS: tenant_id must match authenticated user's tenant
  Response:
    200: Full configuration object

POST /brands/{brand_id}/config
  Description: Create or replace entire configuration
  Related Event: Configuration created event (implied)
  RLS: tenant_id validation
  Body: Complete config object with schema_version

PATCH /brands/{brand_id}/config/theme
  Description: Update theme configuration
  RLS: tenant_id validation
  Body: Partial theme object
  Response: Updated theme object

PATCH /brands/{brand_id}/config/workflows
  Description: Update workflow definitions
  Related Events: Workflow modifications trigger audit events
  RLS: tenant_id validation
  Body: Workflows object

PATCH /brands/{brand_id}/config/feature-flags
  Description: Update feature flags (hot reload)
  RLS: tenant_id validation
  Body: Feature flags object
  Response: Updated flags with applied_at timestamp

PATCH /brands/{brand_id}/config/channels
  Description: Update channel configuration
  Related Events: Webhook notifications if registered
  RLS: tenant_id validation
  Body: Channels object

PATCH /brands/{brand_id}/config/plugin-hooks
  Description: Update plugin hook configuration
  Related Events: plugin.activated or plugin.deactivated
  RLS: tenant_id validation
  Body: Plugin hooks object

PATCH /brands/{brand_id}/config/runtime-overrides
  Description: Update runtime overrides
  RLS: tenant_id validation + requires admin scope
  Body: Runtime overrides object

GET /brands/{brand_id}/config/audit-log
  Description: Retrieve configuration change history
  RLS: tenant_id validation
  Query params: limit, offset, from_date, to_date
  Response: Paginated audit records
```

---

## 10. Configuration Validation

### 10.1 Validation Rules

All configurations must pass JSON Schema validation before being saved:

```typescript
// Validation example
function validateConfiguration(config: unknown): ValidationResult {
  // 1. Check schema_version exists
  if (!config.schema_version) {
    throw new ValidationError('schema_version is required');
  }
  
  // 2. Validate against appropriate JSON Schema
  const schema = getSchema(config.schema_version);
  const valid = ajv.validate(schema, config);
  
  if (!valid) {
    throw new ValidationError('Configuration validation failed', ajv.errors);
  }
  
  // 3. Check tenant isolation
  if (config.tenant_id !== currentTenant) {
    throw new ForbiddenError('Tenant mismatch');
  }
  
  // 4. Check dependencies (e.g., referenced plugins exist)
  for (const hook of config.plugin_hooks?.*.hooks || []) {
    const plugin = await getPlugin(hook.plugin_id);
    if (!plugin) {
      throw new ValidationError(`Plugin ${hook.plugin_id} not found`);
    }
  }
  
  return { valid: true };
}
```

### 10.2 Schema Evolution

- **v1.0.0**: Initial schema
- **v1.1.0**: Add new field (backward compatible)
- **v2.0.0**: Remove field (breaking change - migration required)

```typescript
async function migrateConfiguration(oldConfig: v1, targetVersion: string) {
  let config = oldConfig;
  
  if (config.schema_version === '1.0.0' && targetVersion >= '1.1.0') {
    // Add new optional field with default
    config.new_field = config.new_field || 'default_value';
  }
  
  if (config.schema_version === '1.x.x' && targetVersion === '2.0.0') {
    // Migrate old field to new structure
    config.new_structure = migrateOldField(config.old_field);
    delete config.old_field;
  }
  
  config.schema_version = targetVersion;
  return config;
}
```

---

## 11. Configuration Deployment Strategies

### 11.1 Direct Deployment

Update configuration via API and enable immediate effect (with hot reload support):

```bash
# Update feature flag (immediate effect)
curl -X PATCH https://api.example.com/v1/brands/brand-001/config/feature-flags \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "flags": {
      "catalog": {
        "ai_recommendations": {
          "enabled": true,
          "rollout_percentage": 100
        }
      }
    }
  }'
```

### 11.2 Configuration as Code (GitOps)

Store configuration in Git and deploy via CI/CD:

```yaml
# brand-config.yaml
apiVersion: commerce.unified/v1
kind: BrandConfiguration
metadata:
  tenant_id: org-001
  brand_id: brand-001
spec:
  theme:
    colors:
      primary: "#0066CC"
  feature_flags:
    ai_recommendations:
      enabled: true
      rollout_percentage: 100
```

---

## 12. Related Events & Audit Trail

Configuration changes trigger the following events in the event catalog:

| Event Type | Triggers When | Producer | Consumers |
|------------|---------------|----------|-----------|
| `tenant.config_updated` | Tenant config changed | Config API | Audit Service, Notifications |
| `brand.config_updated` | Brand config changed | Config API | Webhook handlers, Audit Service |
| `workflow.configuration_changed` | Workflow definition updated | Config API | Workflow Engine, Audit Service |
| `feature_flag.changed` | Feature flag toggled | Config API | Feature Flag Service, Analytics |
| `plugin.hook_registered` | Plugin hook added | Config API | Plugin Manager, Audit Service |
| `channel.configured` | Channel settings updated | Config API | Channel Manager, Sync Services |

---

## 13. Example: Complete Brand Configuration

```json
{
  "tenant_id": "org-uuid-001",
  "brand_id": "brand-uuid-001",
  "name": "Acme Retail",
  "settings": {
    "schema_version": "1.0.0",
    "theme": {
      "enabled": true,
      "primary_theme": {
        "name": "corporate_blue",
        "colors": {
          "primary": "#0066CC",
          "secondary": "#FF9900"
        }
      }
    },
    "workflows": {
      "order_fulfillment": {
        "enabled": true,
        "steps": [/* ... */]
      }
    },
    "feature_flags": {
      "catalog": {
        "ai_recommendations": {
          "enabled": true,
          "rollout_percentage": 100
        }
      }
    },
    "channels": {
      "primary_storefront": {
        "channel_id": "channel-001",
        "type": "storefront",
        "status": "active"
      }
    },
    "plugin_hooks": {
      "order_creation_pre": {
        "enabled": true,
        "hooks": [/* ... */]
      }
    },
    "runtime_overrides": {
      "maintenance_mode": {
        "enabled": false
      }
    }
  }
}
```

---

## References

- **Event Catalog**: `/docs/domain/event-catalog.md`
- **Canonical Data Model**: `/docs/domain/canonical-data-model.md`
- **Architecture Blueprint**: `/docs/architecture/unified-commerce-os-architecture.md`
- **OpenAPI Specs**:
  - Foundation API: `/api/openapi/foundation.yaml`
  - Commerce API: `/api/openapi/commerce.yaml`
  - E-Commerce API: `/api/openapi/ecommerce.yaml`

---

**Last Updated**: 2024-01-16  
**Version**: 1.0.0  
**Status**: Active
