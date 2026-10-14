import Link from "next/link";
import { isAdmin, roleLabels } from "@/lib/permissions";
import LogoutButton from "./logout-button";

export default function AccountShell({ user, active, children }) {
  return (
    <div className="account-layout">
      <header className="account-header">
        <Link className="brand" href="/dashboard">
          <span className="brand-mark">A</span> 账号中心
        </Link>
        <div className="header-user">
          <span className="badge">{roleLabels[user.role]}</span>
          <span className="header-name">{user.name}</span>
          <LogoutButton />
        </div>
      </header>
      <div className="account-container">
        <nav className="account-nav" aria-label="账号导航">
          <Link
            className={active === "profile" ? "active" : ""}
            href="/dashboard"
          >
            个人资料
          </Link>
          {isAdmin(user) && (
            <Link className={active === "admin" ? "active" : ""} href="/admin">
              用户管理
            </Link>
          )}
        </nav>
        <main className="account-main">{children}</main>
      </div>
    </div>
  );
}
