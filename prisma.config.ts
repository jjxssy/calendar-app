// Prisma CLI does not load Next.js .env.local automatically.
// Load .env first, then let private local values override it.
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

config({ path: ".env" });
config({ path: ".env.local", override: true });

const databaseUrl = process.env["DATABASE_URL"];

if (!databaseUrl || databaseUrl.includes("prisma+postgres://localhost")) {
  throw new Error(
    "DATABASE_URL must be set in .env.local to your private Supabase Postgres connection string.",
  );
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
  },
});
