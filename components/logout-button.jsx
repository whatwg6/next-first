"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const router = useRouter();
  async function logout() {
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("退出失败");
      router.replace("/login");
      router.refresh();
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <div>
      <button
        className="button secondary compact"
        onClick={logout}
        disabled={pending}
      >
        {pending ? "退出中…" : "退出登录"}
      </button>
      {failed && (
        <p className="error-text small" role="alert">
          退出失败，请重试
        </p>
      )}
    </div>
  );
}
