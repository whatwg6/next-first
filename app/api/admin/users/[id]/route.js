import { z } from "zod";
import { getPool } from "@/lib/db";
import { canManageUser, isAdmin } from "@/lib/permissions";
import { getSession } from "@/lib/session";

const updateSchema = z
  .object({
    disabled: z.boolean().optional(),
    role: z.enum(["user", "admin"]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0);

export async function PATCH(request, { params }) {
  const session = await getSession(request.headers);
  if (!session) return Response.json({ message: "请先登录" }, { status: 401 });
  if (!isAdmin(session.user))
    return Response.json({ message: "没有管理权限" }, { status: 403 });
  if (
    request.headers.get("origin") !==
    new URL(process.env.BETTER_AUTH_URL).origin
  ) {
    return Response.json({ message: "请求来源不正确" }, { status: 403 });
  }
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ message: "参数不正确" }, { status: 400 });
  const { id } = await params;
  const db = await getPool().connect();
  try {
    await db.query("BEGIN");
    // Lock the actor and target together so permissions cannot change mid-update.
    const { rows } = await db.query(
      'SELECT id, role, disabled FROM "user" WHERE id = ANY($1::text[]) ORDER BY id FOR UPDATE',
      [[session.user.id, id]],
    );
    const actor = rows.find((user) => user.id === session.user.id);
    const target = rows.find((user) => user.id === id);
    const active = await db.query(
      'SELECT id FROM session WHERE id = $1 AND "expiresAt" > NOW()',
      [session.session.id],
    );
    if (!actor || actor.disabled || !active.rowCount) {
      await db.query("ROLLBACK");
      return Response.json({ message: "请重新登录" }, { status: 401 });
    }
    if (!target) {
      await db.query("ROLLBACK");
      return Response.json({ message: "用户不存在" }, { status: 404 });
    }
    if (
      !canManageUser(actor, target) ||
      (parsed.data.role !== undefined && actor.role !== "superadmin")
    ) {
      await db.query("ROLLBACK");
      return Response.json(
        { message: "没有权限操作这个账号" },
        { status: 403 },
      );
    }
    await db.query(
      'UPDATE "user" SET role = $2, disabled = $3, "updatedAt" = NOW() WHERE id = $1',
      [
        id,
        parsed.data.role ?? target.role,
        parsed.data.disabled ?? target.disabled,
      ],
    );
    await db.query('DELETE FROM session WHERE "userId" = $1', [id]);
    await db.query("COMMIT");
    return Response.json({ message: "已保存，用户需要重新登录" });
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
