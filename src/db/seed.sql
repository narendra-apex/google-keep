-- Sample seed (optional): bun scripts/migrate.ts --seed
-- This creates a default Org/Brand/Location plus a placeholder org admin email in org metadata.

DO $$
DECLARE
  v_tenant_id uuid := '11111111-1111-1111-1111-111111111111';
  v_org_id uuid := '11111111-1111-1111-1111-111111111111';
  v_brand_id uuid := '22222222-2222-2222-2222-222222222222';
  v_location_id uuid := '33333333-3333-3333-3333-333333333333';
BEGIN
  PERFORM set_config('app.current_tenant_id', v_tenant_id::text, true);

  INSERT INTO orgs (org_id, tenant_id, name, metadata)
  VALUES (v_org_id, v_tenant_id, 'Default Org', jsonb_build_object('default_admin_email', 'admin@default-org.example'))
  ON CONFLICT (tenant_id) DO NOTHING;

  INSERT INTO brands (brand_id, tenant_id, org_id, name)
  VALUES (v_brand_id, v_tenant_id, v_org_id, 'Default Brand')
  ON CONFLICT (brand_id) DO NOTHING;

  INSERT INTO locations (location_id, tenant_id, org_id, brand_id, name, type)
  VALUES (v_location_id, v_tenant_id, v_org_id, v_brand_id, 'Default Location', 'warehouse')
  ON CONFLICT (location_id) DO NOTHING;
END;
$$;
