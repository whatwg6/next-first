import AccountShell from "@/components/account-shell";
import ProfileForm from "@/components/profile-form";
import { requireUser } from "@/lib/session";

export const metadata = { title: "个人资料" };

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <AccountShell user={user} active="profile">
      <div className="page-heading">
        <span className="eyebrow">MY ACCOUNT</span>
        <h1>你好，{user.name}</h1>
        <p className="muted">在这里管理你的个人资料与账号安全。</p>
      </div>
      <ProfileForm user={user} />
    </AccountShell>
  );
}
