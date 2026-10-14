import "./load-env.js";
import { getMigrations } from "better-auth/db/migration";
import { getAuth } from "../lib/auth.js";
import { getPool } from "../lib/db.js";

try {
  const migration = await getMigrations(getAuth().options);
  await migration.runMigrations();
  console.log("数据库表已就绪（用户、账号、会话、验证令牌、限流）。");
} finally {
  await getPool().end();
}
