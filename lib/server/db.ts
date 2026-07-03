import mysql, { type Pool, type PoolOptions } from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import * as schema from "./schema";

// MySQL connection pool. Supports either a single DATABASE_URL (e.g. from a
// managed provider) or discrete DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME
// env vars (used for local development against Laragon/Docker MySQL).

type DB = MySql2Database<typeof schema>;

let pool: Pool | null = null;
let db: DB | null = null;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
}

function poolConfig(): PoolOptions {
  if (process.env.DATABASE_URL) {
    return { uri: process.env.DATABASE_URL, connectionLimit: Number(process.env.DB_POOL_MAX ?? 10) };
  }
  return {
    host: required("DB_HOST"),
    port: Number(process.env.DB_PORT ?? 3306),
    user: required("DB_USER"),
    password: process.env.DB_PASSWORD ?? "",
    database: required("DB_NAME"),
    connectionLimit: Number(process.env.DB_POOL_MAX ?? 10),
    ssl: process.env.DB_SSL === "require" ? { rejectUnauthorized: true } : undefined,
  };
}

export function getPool(): Pool {
  if (!pool) pool = mysql.createPool(poolConfig());
  return pool;
}

export function getDb(): DB {
  if (!db) db = drizzle(getPool(), { schema, mode: "default" });
  return db;
}

/** True when DB env is present (so callers can degrade gracefully). */
export function isDbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_NAME));
}
