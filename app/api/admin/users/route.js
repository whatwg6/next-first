import { getPool } from "@/lib/db";
import { isAdmin } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export async function GET(request) {
  const session = await getSession(request.headers);
  if (!session) return Response.json({ message: "请先登录" }, { status: 401 });
  if (!isAdmin(session.user))
    return Response.json({ message: "没有管理权限" }, { status: 403 });
  const search = new URL(request.url).searchParams;
  const page = Math.max(
    1,
    Math.min(10000, Number.parseInt(search.get("page") || "1", 10) || 1),
  );
  const keyword = (search.get("q") || "").trim().slice(0, 100);
  // Administrators can only see ordinary users; superadmins can see all roles.
  const scope = session.user.role === "admin" ? "user" : null;
  const filter =
    "($1::text IS NULL OR role = $1) AND (name ILIKE $2 OR email ILIKE $2)";
  const values = [scope, `%${keyword}%`];
  const { rows } = await getPool().query(
    `SELECT id, name, email, "emailVerified", role, disabled, "createdAt"
     FROM "user" WHERE ${filter} ORDER BY "createdAt" DESC, id LIMIT 20 OFFSET $3`,
    [...values, (page - 1) * 20],
  );
  const count = await getPool().query(
    `SELECT COUNT(*)::int AS total FROM "user" WHERE ${filter}`,
    values,
  );
  return Response.json({ users: rows, total: count.rows[0].total, page });
}
