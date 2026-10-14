"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, authError } from "@/lib/auth-client";

export default function ProfileForm({ user }) {
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState(null);
  const router = useRouter();
  async function submit(event, kind) {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setNotice(null);
    if (
      kind === "password" &&
      data.get("newPassword") !== data.get("confirmPassword")
    ) {
      setNotice({ kind, error: true, message: "两次输入的密码不一致" });
      return;
    }
    setPending(kind);
    try {
      const result =
        kind === "name"
          ? await authClient.updateUser({ name: data.get("name").trim() })
          : await authClient.changePassword({
              currentPassword: data.get("currentPassword"),
              newPassword: data.get("newPassword"),
              revokeOtherSessions: true,
            });
      if (result.error) {
        setNotice({ kind, error: true, message: authError(result.error) });
      } else {
        setNotice({
          kind,
          error: false,
          message:
            kind === "name" ? "昵称已更新" : "密码已更新，其他设备已退出登录",
        });
        if (kind === "password") form.reset();
        router.refresh();
      }
    } catch {
      setNotice({ kind, error: true, message: "操作失败，请稍后重试" });
    } finally {
      setPending("");
    }
  }
  function feedback(kind) {
    return (
      notice?.kind === kind && (
        <div
          className={`notice ${notice.error ? "error" : "success"}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.message}
        </div>
      )
    );
  }
  return (
    <div className="profile-grid">
      <section className="panel">
        <h2>基本资料</h2>
        <p className="muted panel-description">你的账号信息与个人称呼。</p>
        <form className="stack" onSubmit={(event) => submit(event, "name")}>
          <label>
            昵称
            <input
              name="name"
              autoComplete="nickname"
              defaultValue={user.name}
              required
              maxLength={40}
            />
          </label>
          <label>
            邮箱地址
            <input type="email" value={user.email} readOnly />
            <span className="field-hint">✓ 邮箱已验证</span>
          </label>
          {feedback("name")}
          <button className="button fit" disabled={Boolean(pending)}>
            {pending === "name" ? "保存中…" : "保存资料"}
          </button>
        </form>
      </section>
      <section className="panel">
        <h2>修改密码</h2>
        <p className="muted panel-description">
          修改后，其他设备需要重新登录。
        </p>
        <form className="stack" onSubmit={(event) => submit(event, "password")}>
          <label>
            当前密码
            <input
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            新密码
            <input
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              placeholder="至少 8 个字符"
            />
          </label>
          <label>
            确认新密码
            <input
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
            />
          </label>
          {feedback("password")}
          <button className="button secondary fit" disabled={Boolean(pending)}>
            {pending === "password" ? "更新中…" : "更新密码"}
          </button>
        </form>
      </section>
    </div>
  );
}
