import "./globals.css";

export const metadata = {
  title: { default: "账号中心", template: "%s · 账号中心" },
  description: "邮箱注册、登录与账号管理",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
