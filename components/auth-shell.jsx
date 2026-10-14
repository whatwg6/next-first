import Link from "next/link";

export default function AuthShell({ title, description, children }) {
  return (
    <main className="auth-layout">
      <aside className="auth-aside">
        <Link href="/" className="brand">
          <span className="brand-mark">A</span> 账号中心
        </Link>
        <div className="auth-intro">
          <span className="eyebrow">YOUR PERSONAL SPACE</span>
          <h1>
            从这里开始，
            <br />
            连接你的空间。
          </h1>
          <p>
            一个账号，让每一次访问都有归属。
            <br />
            随时登录，轻松管理。
          </p>
          <div className="intro-art" aria-hidden="true">
            <div className="art-ring" />
            <div className="art-card">
              <span className="art-avatar">A</span>
              <span>
                欢迎回来
                <i />
              </span>
              <b>✓</b>
            </div>
          </div>
        </div>
        <p className="aside-footer">简单 · 安心 · 有序</p>
      </aside>
      <section className="auth-main">
        <div className="auth-card">
          <Link href="/" className="mobile-brand brand">
            <span className="brand-mark">A</span> 账号中心
          </Link>
          <h2>{title}</h2>
          <p className="muted auth-description">{description}</p>
          {children}
        </div>
        <p className="auth-footer">你的账号，你的空间。</p>
      </section>
    </main>
  );
}
