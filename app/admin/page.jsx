import { redirect } from "next/navigation";
import AccountShell from "@/components/account-shell";
import UserManagement from "@/components/user-management";
import { isAdmin } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export const metadata = { title: "用户管理" };

export default async function AdminPage() {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/dashboard");
  return (
    <AccountShell user={user} active="admin">
      <div className="page-heading">
        <span className="eyebrow">USER MANAGEMENT</span>
        <h1>用户管理</h1>
        <p className="muted">
          {user.role === "superadmin"
            ? "管理用户状态，设置普通用户与管理员角色。"
            : "查看普通用户，管理账号的启用与禁用状态。"}
        </p>
      </div>
      <UserManagement actor={user} />
    </AccountShell>
  );
}
