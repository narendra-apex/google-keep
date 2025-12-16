import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const COMPOSE_FILE = new URL("../../../docker-compose.test.yml", import.meta.url);
const POSTGRES_URL = "postgres://postgres:postgres@localhost:54321/postgres";
const APP_USER = {
  user: "app_test_user",
  password: "app_test_password"
};

async function dockerCompose(args: string[]) {
  try {
    return await execFileAsync("docker", [
      "compose",
      "-f",
      COMPOSE_FILE.pathname,
      ...args
    ]);
  } catch (err: any) {
    if (err?.code === "ENOENT") throw err;

    try {
      return await execFileAsync("docker-compose", [
        "-f",
        COMPOSE_FILE.pathname,
        ...args
      ]);
    } catch {
      throw err;
    }
  }
}

async function waitForPostgres(url: string, timeoutMs = 60_000) {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const client = new Client({ connectionString: url });
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch {
      if (Date.now() - started > timeoutMs) {
        throw new Error("Timed out waiting for Postgres to be ready");
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

async function ensureAppUser() {
  const admin = new Client({ connectionString: POSTGRES_URL });
  await admin.connect();
  try {
    const res = await admin.query(
      "SELECT 1 FROM pg_roles WHERE rolname = $1",
      [APP_USER.user]
    );
    if (res.rowCount === 0) {
      await admin.query(
        `CREATE ROLE ${APP_USER.user} LOGIN PASSWORD '${APP_USER.password}' NOSUPERUSER NOCREATEDB NOCREATEROLE;`
      );
    }
  } finally {
    await admin.end();
  }
}

async function createDatabase(dbName: string) {
  const admin = new Client({ connectionString: POSTGRES_URL });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${dbName}`);
  } finally {
    await admin.end();
  }
}

async function dropDatabase(dbName: string) {
  const admin = new Client({ connectionString: POSTGRES_URL });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE ${dbName} WITH (FORCE)`);
  } finally {
    await admin.end();
  }
}

function dbUrl(dbName: string, user = "postgres", password = "postgres") {
  return `postgres://${user}:${password}@localhost:54321/${dbName}`;
}

async function runMigrations(databaseUrl: string) {
  await execFileAsync("bun", ["scripts/migrate.ts"], {
    cwd: new URL("../../../", import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
}

async function grantAppUser(databaseName: string) {
  const admin = new Client({ connectionString: dbUrl(databaseName) });
  await admin.connect();
  try {
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${APP_USER.user};`);
    await admin.query(`GRANT USAGE ON SCHEMA app TO ${APP_USER.user};`);
    await admin.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_USER.user};`
    );
    await admin.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_USER.user};`
    );
  } finally {
    await admin.end();
  }
}

async function setTenant(client: Client, tenantId: string) {
  await client.query("SET app.current_tenant_id = $1", [tenantId]);
}

beforeAll(async () => {
  await dockerCompose(["up", "-d"]);
  await waitForPostgres(POSTGRES_URL);
  await ensureAppUser();
});

afterAll(async () => {
  await dockerCompose(["down", "-v"]);
});

describe("Postgres RLS + migrations", () => {
  it("runs migrations cleanly on a fresh database", async () => {
    const databaseName = `ucom_test_${Date.now()}`;
    await createDatabase(databaseName);
    try {
      await runMigrations(dbUrl(databaseName));

      const client = new Client({ connectionString: dbUrl(databaseName) });
      await client.connect();
      try {
        const tables = [
          "orgs",
          "brands",
          "locations",
          "products",
          "suppliers",
          "inventory",
          "purchase_orders",
          "orders",
          "customers"
        ];

        for (const table of tables) {
          const res = await client.query(
            "SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = $1",
            [table]
          );
          expect(res.rowCount).toBe(1);
          expect(res.rows[0].relrowsecurity).toBe(true);
          expect(res.rows[0].relforcerowsecurity).toBe(true);
        }
      } finally {
        await client.end();
      }
    } finally {
      await dropDatabase(databaseName);
    }
  });

  it("blocks cross-tenant reads and writes", async () => {
    const databaseName = `ucom_test_${Date.now()}_rls`;
    await createDatabase(databaseName);
    try {
      await runMigrations(dbUrl(databaseName));
      await grantAppUser(databaseName);

      const app = new Client({
        connectionString: dbUrl(databaseName, APP_USER.user, APP_USER.password)
      });
      await app.connect();

      const tenantA = crypto.randomUUID();
      const tenantB = crypto.randomUUID();

      const orgA = crypto.randomUUID();
      const brandA = crypto.randomUUID();
      const orgB = crypto.randomUUID();
      const brandB = crypto.randomUUID();

      try {
        await setTenant(app, tenantA);
        await app.query(
          "INSERT INTO orgs (org_id, tenant_id, name) VALUES ($1, $2, $3)",
          [orgA, tenantA, "Org A"]
        );
        await app.query(
          "INSERT INTO brands (brand_id, tenant_id, org_id, name) VALUES ($1, $2, $3, $4)",
          [brandA, tenantA, orgA, "Brand A"]
        );

        await setTenant(app, tenantB);
        await app.query(
          "INSERT INTO orgs (org_id, tenant_id, name) VALUES ($1, $2, $3)",
          [orgB, tenantB, "Org B"]
        );
        await app.query(
          "INSERT INTO brands (brand_id, tenant_id, org_id, name) VALUES ($1, $2, $3, $4)",
          [brandB, tenantB, orgB, "Brand B"]
        );

        await setTenant(app, tenantA);
        const brandsA = await app.query("SELECT brand_id FROM brands ORDER BY brand_id");
        expect(brandsA.rowCount).toBe(1);
        expect(brandsA.rows[0].brand_id).toBe(brandA);

        // Cross-tenant read should return nothing
        const crossRead = await app.query(
          "SELECT brand_id FROM brands WHERE brand_id = $1",
          [brandB]
        );
        expect(crossRead.rowCount).toBe(0);

        // Cross-tenant insert should be blocked by RLS (tenant_id mismatch)
        await expect(
          app.query(
            "INSERT INTO brands (brand_id, tenant_id, org_id, name) VALUES ($1, $2, $3, $4)",
            [crypto.randomUUID(), tenantB, orgA, "Should Fail"]
          )
        ).rejects.toThrow(/row-level security/i);

        // Cross-tenant update should affect 0 rows (row not visible)
        const updateRes = await app.query(
          "UPDATE brands SET name = 'Hacked' WHERE brand_id = $1",
          [brandB]
        );
        expect(updateRes.rowCount).toBe(0);

        await setTenant(app, tenantB);
        const verifyB = await app.query(
          "SELECT name FROM brands WHERE brand_id = $1",
          [brandB]
        );
        expect(verifyB.rowCount).toBe(1);
        expect(verifyB.rows[0].name).toBe("Brand B");
      } finally {
        await app.end();
      }
    } finally {
      await dropDatabase(databaseName);
    }
  });

  it("enforces Org→Brand→Location lineage and cascades deletions", async () => {
    const databaseName = `ucom_test_${Date.now()}_cascade`;
    await createDatabase(databaseName);
    try {
      await runMigrations(dbUrl(databaseName));
      await grantAppUser(databaseName);

      const app = new Client({
        connectionString: dbUrl(databaseName, APP_USER.user, APP_USER.password)
      });
      await app.connect();

      const tenantA = crypto.randomUUID();
      const tenantB = crypto.randomUUID();

      const orgA = crypto.randomUUID();
      const brandA = crypto.randomUUID();
      const locationA = crypto.randomUUID();

      const orgB = crypto.randomUUID();
      const brandB = crypto.randomUUID();

      try {
        await setTenant(app, tenantA);
        await app.query(
          "INSERT INTO orgs (org_id, tenant_id, name) VALUES ($1, $2, $3)",
          [orgA, tenantA, "Org A"]
        );
        await app.query(
          "INSERT INTO brands (brand_id, tenant_id, org_id, name) VALUES ($1, $2, $3, $4)",
          [brandA, tenantA, orgA, "Brand A"]
        );
        await app.query(
          "INSERT INTO locations (location_id, tenant_id, org_id, brand_id, name) VALUES ($1, $2, $3, $4, $5)",
          [locationA, tenantA, orgA, brandA, "Location A"]
        );

        await setTenant(app, tenantB);
        await app.query(
          "INSERT INTO orgs (org_id, tenant_id, name) VALUES ($1, $2, $3)",
          [orgB, tenantB, "Org B"]
        );
        await app.query(
          "INSERT INTO brands (brand_id, tenant_id, org_id, name) VALUES ($1, $2, $3, $4)",
          [brandB, tenantB, orgB, "Brand B"]
        );

        // tenantA cannot attach a location to tenantB's brand (composite FK will fail)
        await setTenant(app, tenantA);
        await expect(
          app.query(
            "INSERT INTO locations (tenant_id, org_id, brand_id, name) VALUES ($1, $2, $3, $4)",
            [tenantA, orgA, brandB, "Bad Location"]
          )
        ).rejects.toThrow(/foreign key/i);

        // Deleting org cascades to brand and location
        await app.query("DELETE FROM orgs WHERE org_id = $1", [orgA]);

        const remainingBrands = await app.query("SELECT * FROM brands");
        expect(remainingBrands.rowCount).toBe(0);

        const remainingLocations = await app.query("SELECT * FROM locations");
        expect(remainingLocations.rowCount).toBe(0);
      } finally {
        await app.end();
      }
    } finally {
      await dropDatabase(databaseName);
    }
  });
});
