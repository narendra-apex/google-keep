import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required (e.g. postgres://user:pass@host:5432/db)");
  process.exit(1);
}

const schemaUrl = new URL("../src/db/schema.sql", import.meta.url);
const seedUrl = new URL("../src/db/seed.sql", import.meta.url);

const schemaSql = await Bun.file(schemaUrl).text();

const shouldSeed =
  process.argv.includes("--seed") ||
  process.env.DB_SEED === "1" ||
  process.env.DB_SEED === "true";

const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(schemaSql);

  if (shouldSeed) {
    const seedSql = await Bun.file(seedUrl).text();
    await client.query(seedSql);
  }

  console.log("Database migration complete");
} finally {
  await client.end().catch(() => undefined);
}
