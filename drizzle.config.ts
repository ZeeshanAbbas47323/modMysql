import type { Config } from "drizzle-kit";

// Used by `drizzle-kit` to generate/inspect migrations during development
// (against a DATABASE_URL). Production schema is applied via db/schema.sql.
export default {
  schema: "./lib/server/schema.ts",
  out: "./db/migrations",
  dialect: "mysql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      `mysql://${process.env.DB_USER ?? "root"}:${process.env.DB_PASSWORD ?? ""}@${
        process.env.DB_HOST ?? "127.0.0.1"
      }:${process.env.DB_PORT ?? "3306"}/${process.env.DB_NAME ?? "gangsheet"}`,
  },
} satisfies Config;
