import AuthShell from "@/components/auth-shell";
import AuthForm from "@/components/auth-form";

export const metadata = { title: "注册" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="创建你的账号"
      description="填写以下信息，开启你的个人空间。"
    >
      <AuthForm mode="register" />
    </AuthShell>
  );
}
