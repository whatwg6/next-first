"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export function authError(error) {
  const messages = {
    INVALID_EMAIL_OR_PASSWORD: "邮箱或密码不正确",
    EMAIL_NOT_VERIFIED: "请先验证邮箱，再登录",
    ACCOUNT_DISABLED: "账号已被禁用，请联系管理员",
    USER_ALREADY_EXISTS: "邮箱已注册，请直接登录或找回密码",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "邮箱已注册，请直接登录或找回密码",
    INVALID_TOKEN: "链接已失效，请重新申请",
    TOKEN_EXPIRED: "链接已过期，请重新申请",
    INVALID_PASSWORD: "当前密码不正确",
    PASSWORD_TOO_SHORT: "密码至少需要 8 个字符",
    PASSWORD_TOO_LONG: "密码不能超过 128 个字符",
  };
  if (error?.status === 429) return "操作太频繁，请稍后再试";
  return messages[error?.code] || "操作失败，请稍后重试";
}
