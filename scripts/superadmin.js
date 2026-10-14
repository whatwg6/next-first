import "./load-env.js";
import { getPool } from "../lib/db.js";

// Promote an existing verified account; no default passwords or public admin registration.
const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("用法：pnpm create-superadmin 你的邮箱");
  process.exit(1);
}
try {
  const result = await getPool().query(
    'UPDATE "user" SET role = $2, disabled = false, "updatedAt" = NOW() WHERE email = $1 AND "emailVerified" = true RETURNING id',
    [email, "superadmin"],
  );
  if (!result.rowCount) throw new Error("请先在网站注册并验证这个邮箱");
  await getPool().query('DELETE FROM session WHERE "userId" = $1', [
    result.rows[0].id,
  ]);
  console.log("已设为超级管理员，请重新登录。");
} finally {
  await getPool().end();
}
