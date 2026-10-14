import AuthShell from "@/components/auth-shell";
import AuthForm from "@/components/auth-form";

export const metadata = { title: "重置密码" };

export default async function ResetPasswordPage({ searchParams }) {
  const params = await searchParams;
  return (
    <AuthShell title="设置新密码" description="为你的账号设置一个新密码。">
      <AuthForm
        mode="reset"
        token={typeof params.token === "string" ? params.token : ""}
        invalidLink={Boolean(params.error)}
      />
    </AuthShell>
  );
}
