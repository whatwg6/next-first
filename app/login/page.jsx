import AuthShell from "@/components/auth-shell";
import AuthForm from "@/components/auth-form";

export const metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <AuthShell title="欢迎回来" description="登录账号，继续你的旅程。">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
