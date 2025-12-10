# LabZoon 部署指南

本指南详细介绍如何在不同环境中部署 LabZoon 应用。

## 部署选项

1. **Docker Compose (推荐)** - 适合大多数场景，简单快速
2. **Kubernetes** - 适合生产环境，支持自动扩缩容
3. **云平台部署** - Vercel, Netlify, AWS 等平台
4. **传统服务器** - 直接在服务器上运行

## 1. Docker Compose 部署

### 前置条件

- Docker 20.10+
- Docker Compose 2.0+

### 步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/yourusername/labzoon.git
   cd labzoon
   ```

2. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填写必要配置
   ```

3. **构建并启动服务**
   ```bash
   # 生产环境部署
   docker-compose up -d --build
   
   # 查看服务状态
   docker-compose ps
   
   # 查看日志
   docker-compose logs -f labzoon-web
   ```

4. **验证部署**
   - 访问 http://localhost:3000
   - 检查应用是否正常运行

5. **配置反向代理 (可选)**
   
   如果您有域名，可以使用 Nginx 作为反向代理：
   
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

### 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并部署
docker-compose up -d --build

# 清理旧镜像
docker image prune -f
```

## 2. Kubernetes 部署

### 前置条件

- Kubernetes 集群 (v1.20+)
- kubectl 配置正确
- Ingress 控制器 (如 Nginx Ingress)

### 步骤

1. **创建命名空间**
   ```bash
   kubectl create namespace labzoon
   ```

2. **创建 ConfigMap**
   ```bash
   kubectl create configmap labzoon-env \
     --from-env-file=.env \
     --namespace=labzoon
   ```

3. **部署应用**
   ```bash
   # 应用 Kubernetes 配置
   kubectl apply -f k8s/ --namespace=labzoon
   
   # 查看部署状态
   kubectl get pods --namespace=labzoon
   ```

4. **配置 Ingress**
   ```yaml
   apiVersion: networking.k8s.io/v1
   kind: Ingress
   metadata:
     name: labzoon-ingress
     namespace: labzoon
     annotations:
       kubernetes.io/ingress.class: nginx
       cert-manager.io/cluster-issuer: letsencrypt-prod
   spec:
     tls:
     - hosts:
       - your-domain.com
       secretName: labzoon-tls
     rules:
     - host: your-domain.com
       http:
         paths:
         - path: /
           pathType: Prefix
           backend:
             service:
               name: labzoon-service
               port:
                 number: 80
   ```

### 扩缩容

```bash
# 手动扩缩容
kubectl scale deployment labzoon-deployment --replicas=3 --namespace=labzoon

# 查看扩缩容状态
kubectl get pods --namespace=labzoon
```

## 3. 云平台部署

### Vercel 部署

1. **连接 GitHub 仓库**
   - 登录 [Vercel Dashboard](https://vercel.com/dashboard)
   - 点击 "New Project"
   - 选择您的 GitHub 仓库

2. **配置环境变量**
   - 在 Vercel 项目设置中添加环境变量
   - 配置 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 等

3. **部署**
   - Vercel 会自动检测并部署
   - 首次部署后，每次推送代码都会自动重新部署

### Netlify 部署

1. **连接 GitHub 仓库**
   - 登录 [Netlify](https://app.netlify.com/)
   - 点击 "New site from Git"
   - 选择您的 GitHub 仓库

2. **构建设置**
   ```
   Build command: npm run build
   Publish directory: dist
   ```

3. **环境变量**
   - 在 Site settings > Environment variables 中添加

4. **部署**
   - 保存设置后，Netlify 会自动部署

## 4. 传统服务器部署

### 前置条件

- Ubuntu 20.04+ / CentOS 8+
- Node.js 18+
- Nginx (可选)

### 步骤

1. **安装 Node.js**
   ```bash
   # 使用 NodeSource 仓库
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **克隆并构建项目**
   ```bash
   # 创建应用目录
   sudo mkdir -p /var/www/labzoon
   sudo chown $USER:$USER /var/www/labzoon
   
   # 克隆项目
   cd /var/www/labzoon
   git clone https://github.com/yourusername/labzoon.git .
   
   # 安装依赖
   npm install
   
   # 构建生产版本
   npm run build
   ```

3. **安装 PM2 (进程管理器)**
   ```bash
   sudo npm install -g pm2
   ```

4. **启动应用**
   ```bash
   # 创建 PM2 配置文件
   cat > ecosystem.config.js << EOF
   module.exports = {
     apps: [{
       name: 'labzoon',
       script: 'server.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production'
       },
       env_production: {
         NODE_ENV: 'production'
       }
     }]
   };
   EOF
   
   # 启动应用
   pm2 start ecosystem.config.js --env production
   
   # 设置开机自启
   pm2 startup
   pm2 save
   ```

5. **配置 Nginx**
   ```bash
   # 创建 Nginx 配置
   sudo cat > /etc/nginx/sites-available/labzoon << EOF
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade \$http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host \$host;
           proxy_set_header X-Real-IP \$remote_addr;
           proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto \$scheme;
           proxy_cache_bypass \$http_upgrade;
       }
   }
   EOF
   
   # 启用站点
   sudo ln -s /etc/nginx/sites-available/labzoon /etc/nginx/sites-enabled/
   
   # 测试并重载配置
   sudo nginx -t
   sudo systemctl reload nginx
   ```

6. **配置 SSL (可选)**
   ```bash
   # 安装 Certbot
   sudo apt install certbot python3-certbot-nginx
   
   # 获取证书
   sudo certbot --nginx -d your-domain.com
   
   # 设置自动续期
   sudo crontab -e
   # 添加以下行：
   # 0 12 * * * /usr/bin/certbot renew --quiet
   ```

## 数据库配置

### Supabase 配置

1. **创建项目**
   - 登录 [Supabase Dashboard](https://app.supabase.com/)
   - 创建新项目

2. **运行 SQL 脚本**
   - 在 SQL Editor 中运行 `sql/schema_v2.sql`
   - 运行 `sql/user_question_banks.sql`

3. **配置认证**
   - 设置允许的 URL
   - 配置 SMTP (可选)

4. **获取密钥**
   - 从 Settings > API 获取 URL 和密钥
   - 将这些添加到环境变量中

### 自定义数据库部署

如果您不想使用 Supabase，可以部署自己的 PostgreSQL 数据库：

```bash
# 安装 PostgreSQL
sudo apt install postgresql postgresql-contrib

# 创建数据库和用户
sudo -u postgres psql
CREATE DATABASE labzoon;
CREATE USER labzoon_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE labzoon TO labzoon_user;
\q

# 运行迁移脚本
psql -h localhost -U labzoon_user -d labzoon -f sql/schema_v2.sql
```

## 监控和日志

### Docker 日志

```bash
# 查看实时日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f labzoon-web

# 查看最近的日志
docker-compose logs --tail=100 labzoon-web
```

### PM2 日志

```bash
# 查看实时日志
pm2 logs

# 查看特定应用日志
pm2 logs labzoon

# 查看日志文件
cat ~/.pm2/logs/labzoon-out.log
cat ~/.pm2/logs/labzoon-error.log
```

### 系统监控

```bash
# 查看系统资源使用
htop
df -h
free -h

# 查看网络连接
netstat -tlnp | grep :3000
```

## 安全建议

1. **环境变量**
   - 不要将 `.env` 文件提交到版本控制
   - 使用强密码和安全的 API 密钥
   - 定期轮换密钥

2. **网络安全**
   - 使用 HTTPS
   - 配置防火墙规则
   - 启用 CORS 限制

3. **更新维护**
   - 定期更新依赖包
   - 监控安全公告
   - 定期备份数据

## 备份策略

### 数据库备份

```bash
# Supabase 备份 (通过 UI)
# 在 Supabase Dashboard > Settings > Backup 中配置

# 手动导出
supabase db dump --data-only -f backup.sql
```

### 应用备份

```bash
# Docker 环境
docker-compose exec labzoon-web tar -czf /tmp/backup.tar.gz /app/dist
docker cp labzoon_labzoon-web_1:/tmp/backup.tar.gz ./backup-$(date +%Y%m%d).tar.gz

# 服务器环境
tar -czf /var/backups/labzoon-$(date +%Y%m%d).tar.gz /var/www/labzoon/dist
```

## 故障排除

### 常见问题

1. **应用无法启动**
   - 检查环境变量是否正确
   - 检查数据库连接
   - 查看应用日志

2. **数据库连接失败**
   - 验证数据库 URL 和密钥
   - 检查网络连接
   - 确认数据库服务状态

3. **构建失败**
   - 检查 Node.js 版本
   - 清除 node_modules 并重新安装
   - 检查磁盘空间

### 调试技巧

1. **启用详细日志**
   ```bash
   # Docker
   DEBUG=* docker-compose up
   
   # PM2
   pm2 restart labzoon --env debug
   ```

2. **检查网络连接**
   ```bash
   # 测试数据库连接
   curl -I $SUPABASE_URL
   
   # 检查端口
   netstat -tlnp | grep :3000
   ```

3. **性能分析**
   ```bash
   # Node.js 分析
   node --inspect server.js
   
   # 浏览器分析
   # 打开 chrome://inspect
   ```

## 联系支持

如果遇到部署问题，请通过以下方式获取帮助：

1. 查看 [GitHub Issues](https://github.com/yourusername/labzoon/issues)
2. 阅读 [项目 Wiki](https://github.com/yourusername/labzoon/wiki)
3. 查看项目文档
4. 联系项目维护者