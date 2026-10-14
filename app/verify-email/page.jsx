import AuthShell from "@/components/auth-shell";
import AuthForm from "@/components/auth-form";

export const metadata = { title: "验证邮箱" };

export default async function VerifyEmailPage({ searchParams }) {
  const params = await searchParams;
  return (
    <AuthShell title="验证你的邮箱" description="只差一步，即可完成注册。">
      <AuthForm
        mode="verify"
        initialEmail={typeof params.email === "string" ? params.email : ""}
        invalidLink={Boolean(params.error)}
        verified={params.verified === "1" && !params.error}
      />
    </AuthShell>
  );
}
