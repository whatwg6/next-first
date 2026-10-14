import { Pool } from "pg";

// A shared pool also avoids opening a new pool on every development reload.
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("请配置 DATABASE_URL");
  globalThis.accountPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
  });
  return globalThis.accountPool;
}
