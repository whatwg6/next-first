import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { z } from "zod";
import { getPool } from "./db.js";
import { sendAccountEmail } from "./mail.js";

export function getAuth() {
  if (globalThis.accountAuth) return globalThis.accountAuth;
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL = process.env.BETTER_AUTH_URL;
  if (!secret || secret.length < 32 || !baseURL) {
    throw new Error(
      "请配置 BETTER_AUTH_URL 和至少 32 个字符的 BETTER_AUTH_SECRET",
    );
  }
  globalThis.accountAuth = betterAuth({
    appName: "账号中心",
    secret,
    baseURL,
    database: getPool(),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 30 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: ({ user, url }) =>
        sendAccountEmail({ email: user.email, url, kind: "reset" }),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      expiresIn: 60 * 60,
      sendVerificationEmail: ({ user, url }) =>
        sendAccountEmail({ email: user.email, url, kind: "verification" }),
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "user",
          input: false,
        },
        disabled: {
          type: "boolean",
          required: true,
          defaultValue: false,
          input: false,
        },
      },
    },
    session: {
      expiresIn: 7 * 24 * 60 * 60,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: true, storage: "database" },
    advanced: {
      useSecureCookies: new URL(baseURL).protocol === "https:",
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email" || ctx.path === "/update-user") {
          if (ctx.body?.name !== undefined) {
            const name = z
              .string()
              .trim()
              .min(1)
              .max(40)
              .safeParse(ctx.body.name);
            if (!name.success) {
              throw new APIError("BAD_REQUEST", {
                message: "昵称需要 1–40 个字符",
              });
            }
            ctx.body.name = name.data;
          }
        }
      }),
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const { rows } = await getPool().query(
              'SELECT disabled FROM "user" WHERE id = $1',
              [session.userId],
            );
            if (!rows[0] || rows[0].disabled) {
              throw new APIError("FORBIDDEN", {
                code: "ACCOUNT_DISABLED",
                message: "账号已被禁用，请联系管理员",
              });
            }
          },
        },
      },
    },
  });
  return globalThis.accountAuth;
}
