import AuthShell from "@/components/auth-shell";
import AuthForm from "@/components/auth-form";

export const metadata = { title: "找回密码" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="忘记密码了？"
      description="输入注册邮箱，我们会发送重置链接。"
    >
      <AuthForm mode="forgot" />
    </AuthShell>
  );
}
