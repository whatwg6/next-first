# 账号中心

一个用于学习的完整账号系统：JavaScript、Next.js App Router、Better Auth、PostgreSQL、Nodemailer。前端和后端在同一个项目中，使用数据库会话和 HttpOnly Cookie。

## 功能与角色

- 邮箱密码注册、邮箱验证、登录、退出。
- 邮件找回密码：重置链接有效期 30 分钟，使用一次后失效；重置会撤销已有会话。
- 个人资料：修改昵称、修改密码。修改密码会撤销其他设备的会话。
- 管理后台：按昵称/邮箱搜索、分页、禁用/启用用户、调整普通用户/管理员角色。

| 角色                    | 权限                                               |
| ----------------------- | -------------------------------------------------- |
| `user` 普通用户         | 管理自己的昵称与密码                               |
| `admin` 管理员          | 查看、禁用/启用普通用户                            |
| `superadmin` 超级管理员 | 查看所有账号，管理普通用户与管理员，分配管理员角色 |

公开注册总是创建普通用户。超级管理员只能通过服务器命令设置，网页不能修改或禁用超级管理员，也不能操作自己的角色和状态。状态或角色变更会撤销目标用户的会话。

## 本地启动

需要 Node.js 22+、pnpm 和 Docker（PostgreSQL、Mailpit）。

```sh
pnpm install
cp .env.example .env.local
openssl rand -base64 32
```

将生成的随机值填入 `.env.local` 的 `BETTER_AUTH_SECRET`，然后：

```sh
docker compose up -d
pnpm db:migrate
pnpm dev
```

打开 [登录页](http://localhost:3000/login)。注册任意邮箱后，在 [本地测试收件箱](http://localhost:8025) 打开验证邮件，点击链接，再登录。Mailpit 只接收本地测试邮件，不向真实邮箱发送邮件。

`db:migrate` 使用 Better Auth 自带的迁移功能创建用户、密码账号、会话、验证令牌、限流表，可重复运行。数据库持久保存在 Docker volume 中。

本项目 PostgreSQL 映射到本机 `5433` 端口，`.env.local` 的 `DATABASE_URL` 需要使用同一端口。容器内仍使用 `5432`。

### 注册返回 500 时

如果服务端日志出现 `Could not validate the database schema` 或 `ECONNREFUSED`，先检查数据库是否启动：

```sh
# 使用 Colima 时先启动 Docker 后台；使用 Docker Desktop 时先打开应用。
colima start
docker compose up -d
docker compose ps
pnpm db:migrate
```

确认 `.env.local` 的数据库端口为 `5433`。修改连接配置后重启 `pnpm dev`，让数据库连接池使用新配置。注册还需要 Mailpit；验证邮件可在 [本地测试收件箱](http://localhost:8025) 查看。

### 设置超级管理员

先在网页注册并完成邮箱验证，然后在项目目录执行：

```sh
pnpm create-superadmin your-email@example.com
```

重新登录，进入 `/admin`，即可把其他用户设置为管理员。不提供默认管理员密码。

## 配置真实邮件

修改 `.env.local` 中的 SMTP 配置并重启应用：

```dotenv
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASSWORD=your-smtp-password
SMTP_FROM="账号中心 <noreply@your-domain.com>"
```

465 端口一般设置 `SMTP_SECURE=true`；587 端口一般设置 `false`，由 Nodemailer 使用 STARTTLS。具体以邮件服务商要求为准。发件地址需要得到服务商授权，部分服务商需要邮箱授权码而不是登录密码。

## 部署到自己的云服务器

1. 安装 Node.js 22+、pnpm、PostgreSQL，创建数据库和专用数据库账号。
2. 在项目目录创建 `.env.local`，填写真实 `DATABASE_URL`、SMTP 配置、随机 `BETTER_AUTH_SECRET`，将 `BETTER_AUTH_URL` 改成你的 HTTPS 域名。
3. 执行下面的命令，使用 systemd 或 PM2 管理应用进程。

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start --hostname 127.0.0.1
```

使用 Nginx 代理到 `127.0.0.1:3000`，为域名配置 HTTPS。例如，在已有的 HTTPS `server` 块中加入：

```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`X-Real-IP` 用于 Better Auth 的登录限流。应用端口只监听本机，让 Nginx 设置真实 IP。HTTPS 地址会自动使用 Secure Cookie。示例 `compose.yaml` 的密码和 Mailpit 用于本地学习；服务器应使用自己的数据库密码和真实邮件服务。

## 从哪里读代码

| 文件/目录                        | 作用                                                                       |
| -------------------------------- | -------------------------------------------------------------------------- |
| `lib/auth.js`                    | Better Auth 配置：邮箱验证、密码重置、会话、注册默认角色、禁用账号禁止登录 |
| `lib/auth-client.js`             | 浏览器调用认证接口，翻译常见错误                                           |
| `lib/mail.js`                    | 通过 SMTP 发邮件                                                           |
| `lib/session.js`                 | 服务端读取当前会话，保护页面                                               |
| `lib/permissions.js`             | 三种角色的简单规则                                                         |
| `app/api/auth/[...all]/route.js` | Better Auth 的统一接口入口                                                 |
| `app/api/admin/users/`           | 查询用户和更新角色/状态；后端检查权限                                      |
| `components/auth-form.jsx`       | 登录、注册、验证邮件、找回密码的表单                                       |
| `components/profile-form.jsx`    | 修改当前用户的昵称和密码                                                   |
| `components/user-management.jsx` | 管理后台的列表和操作                                                       |
| `scripts/`                       | 数据库初始化、设置超级管理员                                               |

登录凭证不放在 localStorage。浏览器自动发送 HttpOnly Cookie，服务端根据会话读取当前用户。角色来自数据库，不接受浏览器提交的注册角色。管理接口在一次数据库事务中检查权限、修改账号并撤销会话。

## 验证

```sh
pnpm lint
pnpm build
pnpm test
```

集成测试启动临时 PostgreSQL、测试 SMTP 和生产模式的 Next.js 服务，覆盖注册、邮件验证、密码重置、三种角色、禁用账号和会话撤销。它不使用 `.env.local` 中的数据库或发件服务，测试结束后清理临时数据。运行测试前先执行 `pnpm build`，且不要用 root 身份运行临时 PostgreSQL。

如 pnpm 提示忽略了测试 PostgreSQL 的安装脚本，允许当前平台的 `@embedded-postgres/*` 安装脚本后运行 `pnpm rebuild`。这些依赖只用于集成测试。

认证流程参考 [Better Auth 邮箱与密码文档](https://better-auth.com/docs/authentication/email-password)。
