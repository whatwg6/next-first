import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import EmbeddedPostgres from "embedded-postgres";
import { SMTPServer } from "smtp-server";
import { Pool } from "pg";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function runScript(script, env, args = []) {
  const child = spawn(process.execPath, [script, ...args], { env });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    output += chunk;
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, output);
}

test("邮箱认证和三个角色的完整流程", { timeout: 120000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "next-first-test-"));
  const pgPort = await freePort();
  const smtpPort = await freePort();
  const appPort = await freePort();
  const base = `http://127.0.0.1:${appPort}`;
  const database = new EmbeddedPostgres({
    databaseDir: join(directory, "postgres"),
    user: "postgres",
    password: "test-password",
    port: pgPort,
    persistent: false,
    postgresFlags: ["-h", "127.0.0.1", "-k", directory],
    onLog: () => {},
    onError: () => {},
  });
  const messages = [];
  const smtp = new SMTPServer({
    authOptional: true,
    disabledCommands: ["AUTH", "STARTTLS"],
    onData(stream, session, callback) {
      let raw = "";
      stream.on("data", (chunk) => {
        raw += chunk;
      });
      stream.on("end", () => {
        const text = raw
          .replace(/=\r?\n/g, "")
          .replace(/=([0-9A-F]{2})/g, (_, hex) =>
            String.fromCharCode(Number.parseInt(hex, 16)),
          );
        messages.push({ email: session.envelope.rcptTo[0].address, text });
        callback();
      });
    },
  });
  let app;
  let db;
  let databaseStarted = false;
  let smtpStarted = false;
  t.after(async () => {
    if (app && app.exitCode === null) {
      app.kill("SIGTERM");
      await once(app, "exit");
    }
    if (db) await db.end();
    if (smtpStarted) await new Promise((resolve) => smtp.close(resolve));
    if (databaseStarted) await database.stop();
    await rm(directory, { recursive: true, force: true });
  });
  await database.initialise();
  await database.start();
  databaseStarted = true;
  await database.createDatabase("account_test");
  await new Promise((resolve) => smtp.listen(smtpPort, "127.0.0.1", resolve));
  smtpStarted = true;
  const env = {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    DATABASE_URL: `postgresql://postgres:test-password@127.0.0.1:${pgPort}/account_test`,
    BETTER_AUTH_URL: base,
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(smtpPort),
    SMTP_SECURE: "false",
    SMTP_USER: "",
    SMTP_PASSWORD: "",
    SMTP_FROM: "noreply@example.com",
  };
  db = new Pool({ connectionString: env.DATABASE_URL });
  await runScript("scripts/migrate.js", env);
  // Run twice to verify the setup command can safely be repeated.
  await runScript("scripts/migrate.js", env);
  app = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(appPort),
    ],
    { env },
  );
  let appOutput = "";
  app.stdout.on("data", (chunk) => {
    appOutput += chunk;
  });
  app.stderr.on("data", (chunk) => {
    appOutput += chunk;
  });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      ready = (await fetch(`${base}/login`)).ok;
    } catch {
      /* App is starting. */
    }
    if (ready) break;
    if (app.exitCode !== null) assert.fail(appOutput);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, appOutput);

  let requestNumber = 0;
  function client() {
    const jar = new Map();
    return async (path, body, options = {}) => {
      const response = await fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        redirect: "manual",
        ...options,
        headers: {
          "Content-Type": "application/json",
          origin: base,
          cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
          "x-real-ip": `127.1.${Math.floor(++requestNumber / 250)}.${(requestNumber % 250) + 1}`,
          ...options.headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const cookies = response.headers.getSetCookie();
      for (const value of cookies) {
        const pair = value.split(";")[0];
        const separator = pair.indexOf("=");
        jar.set(pair.slice(0, separator), pair.slice(separator + 1));
      }
      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { response, data };
    };
  }
  function mailLink(email, path) {
    const message = messages.findLast(
      (item) => item.email === email && item.text.includes(path),
    );
    assert.ok(message, `没有收到 ${email} 的邮件`);
    return message.text.match(/https?:\/\/[^\s]+/)[0];
  }
  async function verify(email) {
    const response = await fetch(mailLink(email, "/verify-email"), {
      redirect: "manual",
    });
    assert.equal(response.status, 302);
  }
  async function register(email) {
    const result = await client()("/api/auth/sign-up/email", {
      name: "学习账号",
      email,
      password: "Learn12345!",
      callbackURL: "/verify-email?verified=1",
    });
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    await verify(email);
    return result.data.user.id;
  }
  const user = client();
  const admin = client();
  const superadmin = client();
  let userId;
  let adminId;
  let superadminId;

  await t.test("公开页面可访问，未登录不能访问个人页面和管理接口", async () => {
    for (const page of [
      "login",
      "register",
      "forgot-password",
      "reset-password",
      "verify-email",
    ]) {
      assert.equal((await fetch(`${base}/${page}`)).status, 200);
    }
    const result = await client()("/dashboard");
    assert.equal(result.response.status, 307);
    assert.equal(result.response.headers.get("location"), "/login");
    assert.equal((await client()("/api/admin/users")).response.status, 401);
  });

  await t.test("注册强制普通用户，必须验证邮箱，密码以哈希保存", async () => {
    const body = {
      name: "普通用户",
      email: "user@example.com",
      password: "Learn12345!",
      role: "superadmin",
      disabled: true,
      callbackURL: "/verify-email?verified=1",
    };
    const result = await user("/api/auth/sign-up/email", body);
    assert.equal(result.response.status, 200, JSON.stringify(result.data));
    userId = result.data.user.id;
    assert.equal(result.data.user.role, "user");
    assert.equal(result.data.user.disabled, false);
    assert.equal(
      (
        await user("/api/auth/sign-in/email", {
          email: body.email,
          password: body.password,
        })
      ).data.code,
      "EMAIL_NOT_VERIFIED",
    );
    assert.equal(
      (await user("/api/auth/sign-up/email", body)).response.status,
      200,
    );
    assert.equal(
      (await db.query('SELECT id FROM "user" WHERE email = $1', [body.email]))
        .rowCount,
      1,
    );
    const account = await db.query(
      'SELECT password FROM account WHERE "userId" = $1',
      [userId],
    );
    assert.notEqual(account.rows[0].password, body.password);
    await verify(body.email);
    const login = await user("/api/auth/sign-in/email", {
      email: body.email,
      password: body.password,
    });
    assert.equal(login.response.status, 200, JSON.stringify(login.data));
    assert.match(login.response.headers.get("set-cookie"), /httponly/i);
    assert.match(login.response.headers.get("set-cookie"), /samesite=lax/i);
    assert.equal((await user("/api/auth/get-session")).data.user.id, userId);
  });

  await t.test("普通用户只能更新自己，不能自行提升权限", async () => {
    assert.equal((await user("/api/admin/users")).response.status, 403);
    assert.equal(
      (await user("/api/auth/update-user", { role: "superadmin" })).response
        .status,
      400,
    );
    assert.equal(
      (await user("/api/auth/update-user", { name: "新的昵称" })).response
        .status,
      200,
    );
    assert.equal(
      (await user("/api/auth/get-session")).data.user.name,
      "新的昵称",
    );
    assert.equal((await user("/api/auth/get-session")).data.user.role, "user");
  });

  await t.test("超管通过服务器命令初始化，能分配管理员", async () => {
    adminId = await register("admin@example.com");
    superadminId = await register("super@example.com");
    await runScript("scripts/superadmin.js", env, ["super@example.com"]);
    assert.equal(
      (
        await superadmin("/api/auth/sign-in/email", {
          email: "super@example.com",
          password: "Learn12345!",
        })
      ).response.status,
      200,
    );
    assert.equal(
      (
        await superadmin(
          `/api/admin/users/${adminId}`,
          { role: "admin" },
          { method: "PATCH" },
        )
      ).response.status,
      200,
    );
    assert.equal(
      (
        await admin("/api/auth/sign-in/email", {
          email: "admin@example.com",
          password: "Learn12345!",
        })
      ).response.status,
      200,
    );
    const list = await superadmin("/api/admin/users");
    assert.equal(list.data.total, 3);
    assert.ok(list.data.users.every((item) => !item.password && !item.token));
  });

  await t.test("管理员只能管理普通用户，不能改角色或操作超管", async () => {
    const list = await admin("/api/admin/users");
    assert.equal(list.data.total, 1);
    assert.equal(list.data.users[0].id, userId);
    assert.equal(
      (
        await admin(
          `/api/admin/users/${userId}`,
          { role: "admin" },
          { method: "PATCH" },
        )
      ).response.status,
      403,
    );
    assert.equal(
      (
        await admin(
          `/api/admin/users/${superadminId}`,
          { disabled: true },
          { method: "PATCH" },
        )
      ).response.status,
      403,
    );
    assert.equal(
      (
        await superadmin(
          `/api/admin/users/${superadminId}`,
          { role: "user" },
          { method: "PATCH" },
        )
      ).response.status,
      403,
    );
    assert.equal(
      (
        await admin(
          `/api/admin/users/${userId}`,
          { disabled: true },
          { method: "PATCH", headers: { origin: "https://other.example" } },
        )
      ).response.status,
      403,
    );
    assert.equal(
      (
        await admin(
          `/api/admin/users/${userId}`,
          { disabled: true },
          { method: "PATCH" },
        )
      ).response.status,
      200,
    );
    assert.equal((await user("/api/auth/get-session")).data, null);
    assert.equal(
      (
        await user("/api/auth/sign-in/email", {
          email: "user@example.com",
          password: "Learn12345!",
        })
      ).data.code,
      "ACCOUNT_DISABLED",
    );
    assert.equal(
      (
        await admin(
          `/api/admin/users/${userId}`,
          { disabled: false },
          { method: "PATCH" },
        )
      ).response.status,
      200,
    );
    assert.equal(
      (
        await user("/api/auth/sign-in/email", {
          email: "user@example.com",
          password: "Learn12345!",
        })
      ).response.status,
      200,
    );
  });

  await t.test(
    "角色调整立即撤销会话，被降级的管理员不能继续管理用户",
    async () => {
      assert.equal(
        (
          await superadmin(
            `/api/admin/users/${adminId}`,
            { role: "user" },
            { method: "PATCH" },
          )
        ).response.status,
        200,
      );
      assert.equal((await admin("/api/admin/users")).response.status, 401);
      assert.equal(
        (
          await admin("/api/auth/sign-in/email", {
            email: "admin@example.com",
            password: "Learn12345!",
          })
        ).response.status,
        200,
      );
      assert.equal((await admin("/api/admin/users")).response.status, 403);
    },
  );

  await t.test(
    "邮件重置密码只用一次，旧密码及旧会话失效，过期令牌不可用",
    async () => {
      const reset = await client()("/api/auth/request-password-reset", {
        email: "user@example.com",
        redirectTo: "/reset-password",
      });
      assert.equal(reset.response.status, 200);
      const callback = await fetch(
        mailLink("user@example.com", "/reset-password/"),
        { redirect: "manual" },
      );
      const token = new URL(callback.headers.get("location")).searchParams.get(
        "token",
      );
      assert.ok(token);
      const result = await client()("/api/auth/reset-password", {
        token,
        newPassword: "NewLearn12345!",
      });
      assert.equal(result.response.status, 200, JSON.stringify(result.data));
      assert.equal((await user("/api/auth/get-session")).data, null);
      assert.equal(
        (
          await client()("/api/auth/reset-password", {
            token,
            newPassword: "Other12345!",
          })
        ).response.status,
        400,
      );
      assert.equal(
        (
          await client()("/api/auth/sign-in/email", {
            email: "user@example.com",
            password: "Learn12345!",
          })
        ).response.status,
        401,
      );
      assert.equal(
        (
          await user("/api/auth/sign-in/email", {
            email: "user@example.com",
            password: "NewLearn12345!",
          })
        ).response.status,
        200,
      );
      await client()("/api/auth/request-password-reset", {
        email: "user@example.com",
        redirectTo: "/reset-password",
      });
      await db.query(
        "UPDATE verification SET \"expiresAt\" = NOW() - INTERVAL '1 hour' WHERE identifier LIKE 'reset-password:%'",
      );
      const expired = await fetch(
        mailLink("user@example.com", "/reset-password/"),
        { redirect: "manual" },
      );
      assert.match(expired.headers.get("location"), /error=INVALID_TOKEN/);
      assert.equal(
        (
          await client()("/api/auth/request-password-reset", {
            email: "missing@example.com",
            redirectTo: "/reset-password",
          })
        ).response.status,
        200,
      );
    },
  );

  await t.test("退出后会话不可继续使用", async () => {
    assert.equal((await user("/api/auth/sign-out", {})).response.status, 200);
    assert.equal((await user("/api/auth/get-session")).data, null);
  });
});
