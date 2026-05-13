# OpenAI 代理服务（Node + Express）

将 `OPENAI_API_KEY` 放在服务端环境变量，浏览器只请求本服务，**密钥不会出现在前端构建产物中**。

## 项目结构

```text
server/
├── package.json
├── .env.example          # 环境变量模板（可提交）
├── .gitignore            # 忽略 .env / node_modules
├── README.md
└── src/
    └── index.js          # Express 入口：CORS + /v1/chat/completions 转发
```

## 本地运行

1. 安装依赖

   ```bash
   cd server
   npm install
   ```

2. 复制环境变量并填写 Key

   ```bash
   copy .env.example .env
   # 编辑 .env：OPENAI_API_KEY、按需修改 CORS_ORIGINS
   ```

3. 启动

   ```bash
   npm run dev
   ```

   默认监听 **http://localhost:8787**。

4. 健康检查

   ```bash
   curl http://localhost:8787/health
   ```

5. 与前端联调

   在前端项目根目录 `.env` 中设置（勿提交真实地址到公开库时可只用本地）：

   ```env
   VITE_OPENAI_PROXY_URL=http://localhost:8787
   ```

   然后 `npm run dev` 启动 Vite 前端，在「AI 问答」里发问题即可。

---

## 部署到 Render（推荐，适合常驻 Express）

1. 将本仓库推送到 GitHub（确保 **`server/.env` 未被提交**，已在 `server/.gitignore` 中忽略）。
2. 打开 [Render](https://render.com) → **New +** → **Web Service**。
3. 连接仓库，配置：
   - **Root Directory**：`server`
   - **Runtime**：Node
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
4. **Environment** 中添加：
   - `OPENAI_API_KEY` = 你的 sk-…
   - `CORS_ORIGINS` = `https://你的前端域名.com`（多个用英文逗号，无空格）
5. 部署完成后，复制服务 URL（如 `https://xxx.onrender.com`），在前端 `.env.production` 或部署平台环境变量中设置：

   ```env
   VITE_OPENAI_PROXY_URL=https://xxx.onrender.com
   ```

6. 重新构建并部署前端。

> Render 免费实例冷启动较慢，首次请求可能多等几秒。

---

## 部署到 Vercel（说明）

Vercel 以 **Serverless 函数**为主，不适合直接跑「长期监听端口」的 Express 进程。可选做法：

1. **仍用 Render / Railway / Fly.io** 跑本 `server` 目录（简历里写「Node 代理部署在 Render」即可）。
2. 若必须用 Vercel：把 `POST /v1/chat/completions` 改写成 **单文件** `api/chat.js`（Node runtime），在函数内 `fetch` OpenAI 并返回；根目录配置 `vercel.json` 路由。逻辑与本仓库 `src/index.js` 中 `fetch(OPENAI_URL, …)` 一段相同，此处不重复生成第二套代码，避免维护两份。

---

## 安全说明

- 本服务**无鉴权**：任何知道 URL 的人都能消耗你的 Key。生产环境应在前面加 **API Gateway / Cloudflare Access / 简单 Token 校验**（可后续在 `index.js` 里加 `x-proxy-secret` 头比对 `PROXY_SECRET`）。
- 仅转发 `chat/completions`，不开放任意 URL 代理，降低 SSRF 面。
