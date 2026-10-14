"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient, authError } from "@/lib/auth-client";

export default function AuthForm({
  mode,
  initialEmail = "",
  token,
  invalidLink = false,
  verified = false,
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationNeeded, setVerificationNeeded] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const needsPassword = ["login", "register", "reset"].includes(mode);

  async function submit(event) {
    event.preventDefault();
    if (pending) return;
    setMessage("");
    setSuccess(false);
    const data = new FormData(event.currentTarget);
    const password = data.get("password");
    if (
      (mode === "register" || mode === "reset") &&
      password !== data.get("confirmPassword")
    ) {
      setMessage("两次输入的密码不一致");
      return;
    }
    setPending(true);
    try {
      let result;
      const cleanEmail = email.trim().toLowerCase();
      if (mode === "register") {
        result = await authClient.signUp.email({
          name: data.get("name").trim(),
          email: cleanEmail,
          password,
          callbackURL: "/verify-email?verified=1",
        });
      } else if (mode === "login") {
        result = await authClient.signIn.email({
          email: cleanEmail,
          password,
          rememberMe: true,
        });
      } else if (mode === "forgot") {
        result = await authClient.requestPasswordReset({
          email: cleanEmail,
          redirectTo: "/reset-password",
        });
      } else if (mode === "verify") {
        result = await authClient.sendVerificationEmail({
          email: cleanEmail,
          callbackURL: "/verify-email?verified=1",
        });
      } else {
        result = await authClient.resetPassword({
          newPassword: password,
          token,
        });
      }
      if (result.error) {
        setMessage(authError(result.error));
        setVerificationNeeded(result.error.code === "EMAIL_NOT_VERIFIED");
        return;
      }
      if (mode === "login") {
        router.replace("/dashboard");
        router.refresh();
      } else if (mode === "register") {
        router.push(`/verify-email?email=${encodeURIComponent(cleanEmail)}`);
      } else {
        setSuccess(true);
        setMessage(
          mode === "reset"
            ? "密码已更新，请使用新密码登录。"
            : "如果邮箱符合条件，邮件将发送到你的收件箱。请同时检查垃圾邮件。",
        );
      }
    } catch {
      setMessage("服务暂时不可用，请稍后重试");
    } finally {
      setPending(false);
    }
  }

  if (verified)
    return (
      <div className="stack">
        <div className="notice success" role="status">
          邮箱已验证，可以登录了。
        </div>
        <Link className="button" href="/login">
          前往登录 →
        </Link>
      </div>
    );
  if (mode === "reset" && (invalidLink || !token))
    return (
      <div className="stack">
        <div className="notice error" role="alert">
          重置链接无效或已过期，请重新申请。
        </div>
        <Link className="button" href="/forgot-password">
          重新申请重置邮件
        </Link>
      </div>
    );
  if (mode === "reset" && success)
    return (
      <div className="stack">
        <div className="notice success" role="status">
          {message}
        </div>
        <Link className="button" href="/login">
          前往登录 →
        </Link>
      </div>
    );

  const buttonText = {
    login: "登录",
    register: "创建账号",
    forgot: "发送重置邮件",
    verify: "发送验证邮件",
    reset: "保存新密码",
  }[mode];
  return (
    <form onSubmit={submit} className="stack">
      {mode === "verify" && (
        <div className="notice">
          注册后需要验证邮箱。打开邮件里的链接即可完成验证；没有收到时可以在这里重新发送。
        </div>
      )}
      {invalidLink && (
        <div className="notice error" role="alert">
          验证链接无效或已过期，请重新发送。
        </div>
      )}
      {mode === "register" && (
        <label>
          昵称
          <input
            name="name"
            autoComplete="nickname"
            placeholder="怎么称呼你"
            required
            maxLength={40}
          />
        </label>
      )}
      {mode !== "reset" && (
        <label>
          邮箱地址
          <input
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
      )}
      {needsPassword && (
        <label>
          {mode === "reset" ? "新密码" : "密码"}
          <span className="password-field">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              placeholder={mode === "login" ? "输入你的密码" : "至少 8 个字符"}
              required
              minLength={mode === "login" ? undefined : 8}
              maxLength={128}
            />
            <button
              type="button"
              className="password-toggle"
              aria-controls="password"
              aria-label={showPassword ? "隐藏密码" : "显示密码"}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "隐藏" : "显示"}
            </button>
          </span>
        </label>
      )}
      {(mode === "register" || mode === "reset") && (
        <label>
          确认密码
          <input
            name="confirmPassword"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="再次输入密码"
            required
            minLength={8}
            maxLength={128}
          />
        </label>
      )}
      {mode === "login" && (
        <div className="form-links">
          <span className="muted small">登录状态保留 7 天</span>
          <Link href="/forgot-password">忘记密码？</Link>
        </div>
      )}
      {message && (
        <div
          className={`notice ${success ? "success" : "error"}`}
          role={success ? "status" : "alert"}
        >
          {message}
        </div>
      )}
      {verificationNeeded && (
        <Link href={`/verify-email?email=${encodeURIComponent(email.trim())}`}>
          重新发送验证邮件 →
        </Link>
      )}
      <button className="button" disabled={pending} type="submit">
        {pending ? "处理中…" : `${buttonText} →`}
      </button>
      {mode === "login" && (
        <p className="form-bottom">
          还没有账号？ <Link href="/register">免费注册</Link>
        </p>
      )}
      {mode === "register" && (
        <p className="form-bottom">
          已有账号？ <Link href="/login">前往登录</Link>
        </p>
      )}
      {["verify", "forgot", "reset"].includes(mode) && (
        <Link className="back-link" href="/login">
          ← 返回登录
        </Link>
      )}
    </form>
  );
}
