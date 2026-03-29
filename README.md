# arXiv 智能体论文追踪（本地版）

一个可本地运行的网页应用：
- 登录（账号 `admin123` / 密码 `admin123`）
- 每次打开可选择时间窗口
- 点击“立即更新”拉取 arXiv 论文
- 展示题目与摘要（英文原文 + 中文翻译）
- 收藏/取消收藏（浏览器本地持久化）

## 1. 本地运行

> 依赖：Node.js 18+（需支持全局 `fetch`）

```bash
node -v
npm -v
npm start
```

打开：`http://localhost:3000`

## 2. 功能说明

- 主题关键词固定为：
  - `agent`
  - `multi-agent`
  - `autonomous agent`
  - `tool use`
  - `tool calling`
  - `planning`
  - `task decomposition`
  - `agentic`
- 时间窗口支持：1 / 3 / 7 / 14 / 30 / 90 天
- 收藏数据保存在浏览器 `localStorage`

## 3. 常见问题

### Q1: 点击“立即更新”报 `fetch failed`
- 这通常是服务器网络策略导致无法访问：
  - `https://export.arxiv.org`
  - `https://api.mymemory.translated.net`
- 可在服务器上先验证：

```bash
curl -I https://export.arxiv.org/api/query
curl -I 'https://api.mymemory.translated.net/get?q=hello&langpair=en|zh-CN'
```

### Q2: 翻译偶尔不准确
- 当前使用免费翻译接口，速度/质量/限流会波动。
- 若后续你需要，我可以帮你替换为你自己的翻译服务（例如阿里云/火山/腾讯/DeepL/OpenAI）。

## 4. 关联 GitHub 并上传仓库

在项目目录执行（把 `<your-...>` 替换成你的信息）：

```bash
git remote add origin git@github.com:<your-account>/<your-repo>.git
# 或 https://github.com/<your-account>/<your-repo>.git

git push -u origin work
```

如果你想把 `work` 推成 `main`：

```bash
git checkout -b main
git push -u origin main
```

## 5. 阿里云 ECS 部署（Ubuntu 示例）

### 5.1 安装运行时

```bash
sudo apt update
sudo apt install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 5.2 拉取代码并启动

```bash
cd /opt
sudo git clone https://github.com/<your-account>/<your-repo>.git
cd <your-repo>
# 如果你的主分支是 work:
sudo git checkout work

# 本项目无第三方依赖，可直接启动
node server.js
```

### 5.3 使用 systemd 守护进程（推荐）

创建服务文件：

```bash
sudo tee /etc/systemd/system/arxiv-agent.service >/dev/null <<'UNIT'
[Unit]
Description=arXiv Agent Paper Tracker
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/<your-repo>
ExecStart=/usr/bin/node /opt/<your-repo>/server.js
Restart=always
RestartSec=5
Environment=PORT=3000
User=root

[Install]
WantedBy=multi-user.target
UNIT
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable arxiv-agent
sudo systemctl start arxiv-agent
sudo systemctl status arxiv-agent --no-pager
```

### 5.4 配置 Nginx 反向代理（公网访问）

```bash
sudo apt install -y nginx
sudo tee /etc/nginx/sites-available/arxiv-agent >/dev/null <<'NGINX'
server {
    listen 80;
    server_name <your-domain-or-ecs-ip>;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/arxiv-agent /etc/nginx/sites-enabled/arxiv-agent
sudo nginx -t
sudo systemctl restart nginx
```

### 5.5 安全组与防火墙

- 阿里云安全组放行：
  - `22`（SSH）
  - `80`（HTTP）
  - `443`（HTTPS，可选）
- 若启用 UFW：

```bash
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

## 6. 后续可增强

- 多用户登录与服务端鉴权
- 收藏同步到数据库（MySQL/PostgreSQL）
- 定时任务每日自动更新
- 微信/邮件推送新论文
- 一键 Docker 部署

---

如果你愿意，我下一步可以直接给你：
1) **Dockerfile + docker-compose.yml**，
2) **GitHub Actions 自动部署到 ECS**，
3) **HTTPS（Let's Encrypt）自动证书脚本**。
