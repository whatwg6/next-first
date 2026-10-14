import nodemailer from "nodemailer";

export async function sendAccountEmail({ email, url, kind }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    throw new Error("请配置 SMTP_HOST 和 SMTP_FROM");
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
  });
  const verification = kind === "verification";
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: verification ? "验证你的邮箱" : "重置你的密码",
    text: [
      verification
        ? "欢迎注册！请打开以下链接验证邮箱："
        : "请打开以下链接设置新密码：",
      url,
      verification
        ? "链接有效期为 1 小时。"
        : "链接有效期为 30 分钟，使用一次后失效。",
      "如果不是你本人操作，请忽略这封邮件。",
    ].join("\n\n"),
  });
}
