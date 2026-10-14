"use client";

import { useEffect, useState } from "react";
import { canManageUser, roleLabels } from "@/lib/permissions";

export default function UserManagement({ actor }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(
          `/api/admin/users?page=${page}&q=${encodeURIComponent(query)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "加载失败");
        if (!cancelled) {
          setUsers(data.users);
          setTotal(data.total);
        }
      } catch (error) {
        if (!cancelled)
          setNotice({
            error: true,
            message: error.message || "服务暂时不可用",
          });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [page, query, revision]);

  async function update(user, changes) {
    if (pending) return;
    setPending(user.id);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/users/${encodeURIComponent(user.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(changes),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "更新失败");
      setNotice({ error: false, message: data.message });
      setLoading(true);
      setRevision((value) => value + 1);
    } catch (error) {
      setNotice({ error: true, message: error.message || "服务暂时不可用" });
    } finally {
      setPending("");
    }
  }

  function search(event) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);
    setQuery(new FormData(event.currentTarget).get("q").trim());
    setPage(1);
    setRevision((value) => value + 1);
  }

  return (
    <section className="panel users-panel">
      <div className="table-heading">
        <div>
          <h2>
            账号列表 <span className="count">{total}</span>
          </h2>
          <p className="muted small">角色或状态变更后，用户需要重新登录。</p>
        </div>
        <form onSubmit={search} className="search-form">
          <input
            name="q"
            aria-label="搜索昵称或邮箱"
            placeholder="搜索昵称或邮箱"
            maxLength={100}
          />
          <button className="button secondary compact">搜索</button>
        </form>
      </div>
      {notice && (
        <div
          className={`notice ${notice.error ? "error" : "success"}`}
          role={notice.error ? "alert" : "status"}
        >
          {notice.message}
          {notice.error && (
            <button
              className="text-button"
              onClick={() => {
                setLoading(true);
                setNotice(null);
                setRevision((value) => value + 1);
              }}
            >
              重试
            </button>
          )}
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>角色</th>
              <th>邮箱验证</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="empty">
                  加载中…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="empty">
                  没有找到用户
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name}</strong>
                    <span className="table-email">{user.email}</span>
                  </td>
                  <td>
                    <span className="badge">{roleLabels[user.role]}</span>
                  </td>
                  <td>
                    {user.emailVerified ? (
                      <span className="status-dot enabled">已验证</span>
                    ) : (
                      <span className="muted">待验证</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-dot ${user.disabled ? "disabled" : "enabled"}`}
                    >
                      {user.disabled ? "已禁用" : "正常"}
                    </span>
                  </td>
                  <td>
                    {canManageUser(actor, user) ? (
                      <div className="row-actions">
                        <button
                          className={`button compact ${user.disabled ? "secondary" : "danger"}`}
                          disabled={Boolean(pending)}
                          onClick={() =>
                            update(user, { disabled: !user.disabled })
                          }
                        >
                          {pending === user.id
                            ? "处理中…"
                            : user.disabled
                              ? "启用"
                              : "禁用"}
                        </button>
                        {actor.role === "superadmin" && (
                          <button
                            className="button secondary compact"
                            disabled={Boolean(pending)}
                            onClick={() =>
                              update(user, {
                                role: user.role === "admin" ? "user" : "admin",
                              })
                            }
                          >
                            {user.role === "admin" ? "设为用户" : "设为管理员"}
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="muted small">
                        {user.id === actor.id ? "当前账号" : "受保护账号"}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <span className="muted small">
          第 {page} 页 · 共 {Math.max(1, Math.ceil(total / 20))} 页
        </span>
        <div className="row-actions">
          <button
            className="button secondary compact"
            disabled={loading || page <= 1}
            onClick={() => {
              setLoading(true);
              setPage(page - 1);
            }}
          >
            上一页
          </button>
          <button
            className="button secondary compact"
            disabled={loading || page * 20 >= total}
            onClick={() => {
              setLoading(true);
              setPage(page + 1);
            }}
          >
            下一页
          </button>
        </div>
      </div>
    </section>
  );
}
