# biz_wechat_forward

一个部署在公网服务器上的受控 Node 代理，用于把家里电脑发出的请求转发到企业微信接口。公网服务器 IP 加入企业微信白名单，家里电脑只访问该代理服务。

## 架构说明

请求链路：

`Home PC -> https://proxy.example.com/proxy/qyapi/... -> Nginx -> Node proxy -> https://qyapi.weixin.qq.com/...`

职责划分：

- Nginx：处理公网入口、HTTPS、证书、反向代理
- Node：做 Bearer Token 鉴权、签名校验、限流、请求透传、超时控制

功能限制：

- 不是通用代理，只允许转发企业微信官方接口前缀
- 允许的前缀有 `/cgi-bin/`、`/externalcontact/`、`/linkedcorp/`
- 对外统一入口是 `https://你的域名/proxy/qyapi/*`

## 环境要求

- Node.js `>= 18.17`
- Nginx
- Certbot
- 一个已经解析到公网服务器的域名
- 企业微信白名单里加入公网服务器固定 IP

## 目录说明

- 服务端入口：[src/app.js](/D:/Code/biz_wechat_forward/src/app.js)
- 代理逻辑：[src/routes/proxy.js](/D:/Code/biz_wechat_forward/src/routes/proxy.js)
- 鉴权逻辑：[src/middleware/auth.js](/D:/Code/biz_wechat_forward/src/middleware/auth.js)
- Nginx 示例配置：[deploy/nginx.conf](/D:/Code/biz_wechat_forward/deploy/nginx.conf)
- 客户端示例：[examples/client.js](/D:/Code/biz_wechat_forward/examples/client.js)

## 服务端环境配置

先复制环境变量模板：

```bash
cp .env.example .env
```

推荐的 `.env` 内容：

```env
HOST=127.0.0.1
PORT=3000
PROXY_AUTH_TOKEN=replace-with-a-long-random-token
PROXY_SIGNING_SECRET=replace-with-another-long-random-secret
WECOM_BASE_URL=https://qyapi.weixin.qq.com
REQUEST_TIMEOUT_MS=10000
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
TRUST_PROXY=true
```

关键字段说明：

- `HOST`：Node 监听地址，推荐 `127.0.0.1`
- `PORT`：Node 内部监听端口，默认 `3000`
- `PROXY_AUTH_TOKEN`：家里电脑调用代理时带的 Bearer Token
- `PROXY_SIGNING_SECRET`：请求签名用的 HMAC 密钥
- `WECOM_BASE_URL`：企业微信 API 基础地址

## 服务端本地运行

安装依赖：

```bash
npm install
```

直接启动：

```bash
npm start
```

默认监听：

- `http://127.0.0.1:3000`

健康检查：

```bash
curl http://127.0.0.1:3000/healthz
```

返回：

```json
{"ok":true}
```

## Ubuntu 首次部署

下面是一套从环境搭建到运行的顺序示例，假设：

- 域名是 `proxy.example.com`
- 项目目录是 `/opt/biz_wechat_forward`

### 1. 安装基础软件

```bash
sudo apt update
sudo apt install -y nginx
sudo apt install -y certbot python3-certbot-nginx
sudo apt install -y curl
```

安装 Node.js 18 或更高版本。可以用系统包、NodeSource 或 nvm，只要最终版本不低于 `18.17`。

检查版本：

```bash
node -v
npm -v
nginx -v
certbot --version
```

### 2. 部署项目代码

```bash
sudo mkdir -p /opt/biz_wechat_forward
sudo chown $USER:$USER /opt/biz_wechat_forward
cd /opt/biz_wechat_forward
```

然后把项目代码放进这个目录。

### 3. 配置服务端环境变量

```bash
cp .env.example .env
```

按前面的说明填好 `.env`。

### 4. 安装依赖并验证 Node 服务

```bash
npm install
npm start
```

另开一个终端检查：

```bash
curl http://127.0.0.1:3000/healthz
```

如果返回 `{"ok":true}`，说明 Node 服务正常。

## PM2 运行 Node 服务

如果服务器还没装 PM2：

```bash
sudo npm install -g pm2
```

启动服务：

```bash
cd /opt/biz_wechat_forward
pm2 start ecosystem.config.js
```

常用命令：

```bash
pm2 status
pm2 logs biz-wechat-forward
pm2 restart biz-wechat-forward
pm2 save
```

设置开机自启：

```bash
pm2 startup
```

执行 `pm2 startup` 输出的那条命令后，再执行：

```bash
pm2 save
```

## Nginx 配置与启动

Nginx 是系统服务，不是项目内脚本。配置文件只是告诉 Nginx 怎么转发，真正的启动和重载要用 `systemctl`。

### 1. 安装 Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

### 2. 放置项目配置

第一次部署时，先不要直接用带证书路径的 HTTPS 配置。应该先使用不依赖证书的启动配置 [deploy/nginx.bootstrap.conf](/D:/Code/biz_wechat_forward/deploy/nginx.bootstrap.conf) 把 Nginx 跑起来。

先复制启动配置到系统目录：

先把deploy/nginx.bootstrap.conf里的内容修改成正确的内容，然后执行如下命令：

```bash
sudo cp deploy/nginx.bootstrap.conf /etc/nginx/sites-available/biz_wechat_forward
sudo ln -s /etc/nginx/sites-available/biz_wechat_forward /etc/nginx/sites-enabled/biz_wechat_forward
```

在申请到证书之后，再切换到正式 HTTPS 配置 [deploy/nginx.conf](/D:/Code/biz_wechat_forward/deploy/nginx.conf)。

正式配置复制方式：

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/biz_wechat_forward
sudo ln -s /etc/nginx/sites-available/biz_wechat_forward /etc/nginx/sites-enabled/biz_wechat_forward
```

你需要先把配置里的这些内容替换成真实值：

- `proxy.example.com`
- `/etc/letsencrypt/live/proxy.example.com/fullchain.pem`
- `/etc/letsencrypt/live/proxy.example.com/privkey.pem`

如果默认站点会冲突，可以移除：

```bash
sudo rm -f /etc/nginx/sites-enabled/default
```

### 3. 检查配置

```bash
sudo nginx -t
```

### 4. 启动和管理 Nginx 服务

```bash
sudo systemctl start nginx
sudo systemctl stop nginx
sudo systemctl restart nginx
sudo systemctl reload nginx
sudo systemctl status nginx
sudo systemctl enable nginx
```

常见使用方式：

- 首次启动：`sudo systemctl start nginx`
- 配置修改后重载：`sudo systemctl reload nginx`
- 检查状态：`sudo systemctl status nginx`
- 设置开机自启：`sudo systemctl enable nginx`

## HTTPS 证书申请与自动续期

推荐使用 Let's Encrypt。

### 1. 申请证书

确认域名已经解析到服务器，并且 Nginx 已经用 [deploy/nginx.bootstrap.conf](/D:/Code/biz_wechat_forward/deploy/nginx.bootstrap.conf) 正常启动后执行：

```bash
sudo certbot --nginx -d proxy.example.com
```

申请完成后检查：

```bash
sudo certbot certificates
sudo nginx -t
sudo systemctl reload nginx
```

如果你是先用启动配置申请证书，再手动切换正式 HTTPS 配置，顺序如下：

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/biz_wechat_forward
sudo nginx -t
sudo systemctl reload nginx
```

### 2. 自动续期

检查 `certbot.timer`：

```bash
sudo systemctl list-timers | grep certbot
sudo systemctl status certbot.timer
```

验证自动续期流程：

```bash
sudo certbot renew --dry-run
```

如果没有 `certbot.timer`，可以用 cron：

```bash
sudo crontab -e
```

加入：

```cron
0 3,15 * * * certbot renew -q --deploy-hook "systemctl reload nginx"
```

### 3. 证书保存位置

如果你使用的是：

```bash
sudo certbot --nginx -d 你的域名
```

证书通常会保存在：

- `/etc/letsencrypt/live/你的域名/fullchain.pem`
- `/etc/letsencrypt/live/你的域名/privkey.pem`

例如域名是 `proxy.example.com`：

- `/etc/letsencrypt/live/proxy.example.com/fullchain.pem`
- `/etc/letsencrypt/live/proxy.example.com/privkey.pem`

不需要把证书复制到项目目录。推荐做法是让 Nginx 直接引用 `/etc/letsencrypt/live/...` 下的路径。

示例：

```nginx
ssl_certificate /etc/letsencrypt/live/proxy.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/proxy.example.com/privkey.pem;
```

补充说明：

- `/etc/letsencrypt/live/...` 通常是给 Nginx 使用的路径
- `/etc/letsencrypt/archive/...` 通常是 Certbot 存放历史版本证书的目录
- 平时只需要关心 `live` 路径

查看实际路径：

```bash
sudo certbot certificates
```

## 防火墙与端口

如果服务器启用了 UFW，至少放行：

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

### 自定义对外端口

这里有两个端口概念：

- Node 内部监听端口：`.env` 里的 `PORT`，默认 `3000`
- Nginx 对外监听端口：Nginx 配置里的 `listen`，默认 `80` 和 `443`

如果你的目标是减少针对默认端口的扫描流量，应该改 Nginx 的 `listen`，不是只改 Node 的 `PORT`。

例如希望 HTTPS 改成 `8443`：

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name proxy.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host:8443$request_uri;
    }
}

server {
    listen 8443 ssl http2;
    listen [::]:8443 ssl http2;
    server_name proxy.example.com;

    ssl_certificate /etc/letsencrypt/live/proxy.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/proxy.example.com/privkey.pem;

    location /proxy/qyapi/ {
        proxy_pass http://127.0.0.1:3000/proxy/qyapi/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

客户端地址也要改成：

```text
https://proxy.example.com:8443/proxy/qyapi/...
```

补充说明：

- `80` 往往还需要保留给 Let's Encrypt 的 HTTP challenge
- 自定义端口只能减少一部分默认扫描，不能替代鉴权和访问控制

## 最终部署验证

检查 Node：

```bash
curl http://127.0.0.1:3000/healthz
```

检查 Nginx：

```bash
sudo nginx -t
sudo systemctl status nginx
```

检查公网健康接口：

```bash
curl https://proxy.example.com/healthz
```

如果用了自定义端口：

```bash
curl https://proxy.example.com:8443/healthz
```

## 客户端调用方式

家里电脑不要直接请求企业微信，改为请求你的公网代理。

示例目标：

- 企业微信原始地址：`https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=xxx&corpsecret=yyy`
- 代理地址：`https://proxy.example.com/proxy/qyapi/cgi-bin/gettoken?corpid=xxx&corpsecret=yyy`

请求头要求：

- `Authorization: Bearer <PROXY_AUTH_TOKEN>`
- `X-Timestamp: <当前毫秒时间戳>`
- `X-Signature: <HMAC_SHA256(timestamp + "\n" + rawBody)>`

签名使用 `PROXY_SIGNING_SECRET` 计算。

签名示例：

```js
const crypto = require("crypto");

function signBody(timestamp, rawBody, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}\n${rawBody}`)
    .digest("hex");
}
```

如果请求没有 body，`rawBody` 使用空字符串。

完整示例见 [examples/client.js](/D:/Code/biz_wechat_forward/examples/client.js)。

### 客户端环境变量

运行 [examples/client.js](/D:/Code/biz_wechat_forward/examples/client.js) 前设置：

- `PROXY_BASE_URL=https://proxy.example.com`
- `PROXY_AUTH_TOKEN=...`
- `PROXY_SIGNING_SECRET=...`
- `WECOM_CORP_ID=...`
- `WECOM_CORP_SECRET=...`
- `WECOM_AGENT_ID=...`
- `WECOM_TO_USER=...`

Linux/macOS 示例：

```bash
export PROXY_BASE_URL=https://proxy.example.com
export PROXY_AUTH_TOKEN=replace-with-proxy-auth-token
export PROXY_SIGNING_SECRET=replace-with-proxy-signing-secret
export WECOM_CORP_ID=wwxxxxxxxxxxxxxxxx
export WECOM_CORP_SECRET=your-corp-secret
export WECOM_AGENT_ID=1000002
export WECOM_TO_USER=UserID1
```

Windows PowerShell 示例：

```powershell
$env:PROXY_BASE_URL="https://proxy.example.com"
$env:PROXY_AUTH_TOKEN="replace-with-proxy-auth-token"
$env:PROXY_SIGNING_SECRET="replace-with-proxy-signing-secret"
$env:WECOM_CORP_ID="wwxxxxxxxxxxxxxxxx"
$env:WECOM_CORP_SECRET="your-corp-secret"
$env:WECOM_AGENT_ID="1000002"
$env:WECOM_TO_USER="UserID1"
```

运行示例：

```bash
node examples/client.js
```

调用流程：

1. 请求 `/proxy/qyapi/cgi-bin/gettoken`
2. 从响应中取出 `access_token`
3. 请求 `/proxy/qyapi/cgi-bin/message/send`
4. 输出企业微信返回结果

如果你自己写客户端，最少要保证：

- URL 使用 `https://你的域名/proxy/qyapi/...`
- Header 带上 `Authorization`
- Header 带上 `X-Timestamp`
- Header 带上 `X-Signature`
- 签名内容是 `timestamp + "\n" + rawBody`

## Debian 部署注意事项

Debian 上的整体方案和 Ubuntu 基本一致，主要差异在安装阶段。

### 1. 先确认 Node 版本

项目要求 Node.js `>= 18.17`：

```bash
node -v
```

如果版本低于 `18.17`，建议使用 NodeSource 或 nvm 安装新版本，不要直接用过旧的系统包。

### 2. Nginx 和 Certbot 安装通常相同

```bash
sudo apt update
sudo apt install -y nginx
sudo apt install -y certbot python3-certbot-nginx
```

检查：

```bash
nginx -v
certbot --version
```

### 3. 自动续期逻辑基本相同

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

如果没有 `certbot.timer`，同样可以用 cron：

```cron
0 3,15 * * * certbot renew -q --deploy-hook "systemctl reload nginx"
```

### 4. 防火墙不一定是 UFW

如果 Debian 没有 `ufw`，就按你的实际环境使用安全组、`iptables` 或 `nftables` 放行 `80`、`443` 或自定义端口。

## 安全建议

- `PROXY_AUTH_TOKEN` 和 `PROXY_SIGNING_SECRET` 使用长随机字符串
- 不要把 token 和 secret 写进代码仓库
- Node 服务只监听 `127.0.0.1`
- 只允许转发企业微信官方路径
- 不要把这个服务做成通用代理
- 如果以后需要大文件上传下载，改成流式转发
