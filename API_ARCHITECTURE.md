# LabZoon API 架构升级指南

## 概述

为了解决客户端直连 Supabase 导致的数据同步缓慢和失败问题，已将应用升级为**客户端-服务器-数据库**三层架构。

### 变更前（直连架构）
```
浏览器 → Supabase 数据库
         ↑ 跨域网络延迟、WebSocket 连接失败等问题
```

### 变更后（API 中间层架构）
```
浏览器 → API 服务器（Express） → Supabase 数据库
         ↑ 本地网络更快、可控的错误处理
```

## 关键改进

1. **性能提升**
   - 浏览器与服务器通信延迟更低（通常在同一网络）
   - 数据库连接由服务器管理，避免客户端跨国连接
   - API 可以并行处理多个请求

2. **安全性增强**
   - 服务器端使用 `SERVICE_ROLE_KEY`（安全密钥），客户端不再知道
   - JWT 令牌验证确保每个请求都是授权的
   - 数据库 RLS（行级安全）策略可以放宽（服务器代理访问）

3. **可靠性提高**
   - 服务器可以实现重试逻辑
   - 更好的错误处理和日志记录

## 前端变更

### 新增文件
- `apiClient.ts` - 前端 API 客户端，所有数据操作都通过这个模块

### 修改的组件
- `App.tsx` - 改用 `apiClient` 代替直连 Supabase
- `components/AdminUserManagement.tsx` - 改用 `apiClient.fetchAdmins()` 等
- `components/Leaderboard.tsx` - 改用 `apiClient.fetchLeaderboard()`

### 使用方式示例

**Before（直连）:**
```typescript
const { data, error } = await supabase
  .from('user_progress')
  .select('data')
  .eq('user_id', userId)
  .single();
```

**After（通过 API）:**
```typescript
const progress = await apiClient.fetchUserProgress();
```

## 后端（新增）

### 新增文件
- `server.ts` - Express 服务器，所有 API 端点的实现

### API 端点列表

#### 数据获取
- `GET /api/units` - 获取全局课程数据
- `GET /api/user/progress` - 获取当前用户的进度
- `GET /api/knowledge-base` - 获取知识库
- `GET /api/admins` - 获取管理员列表
- `GET /api/leaderboard` - 获取排行榜

#### 数据更新（需要认证）
- `POST /api/units` - 更新课程数据（仅管理员）
- `POST /api/user/progress` - 更新用户进度
- `POST /api/knowledge-base` - 添加知识库项目（仅管理员）
- `DELETE /api/knowledge-base/:id` - 删除知识库项目（仅管理员）
- `POST /api/admins` - 添加管理员（仅管理员）
- `DELETE /api/admins/:email` - 移除管理员（仅管理员）
- `POST /api/init-user` - 初始化新用户

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：
```bash
cp .env.example .env
```

编辑 `.env` 文件，填入：
```env
# Supabase 公钥（前端可见）
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# API URL（前端使用）
VITE_API_URL=http://localhost:5000/api

# 后端配置（仅服务器使用）
PORT=5000
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
```

**获取这些值的方法：**
- 登录 Supabase 后台
- 进入 "Project Settings" → "API"
- 找到以下内容：
  - `Project URL` → `VITE_SUPABASE_URL`
  - `Anon public key` → `VITE_SUPABASE_ANON_KEY`
  - `Service role secret` → `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT Secret` → `SUPABASE_JWT_SECRET`

### 3. 开发环境运行

**同时运行前端和后端：**
```bash
npm run dev:full
```

或分别运行：
```bash
# Terminal 1: 后端服务器 (端口 5000)
npm run dev:server

# Terminal 2: 前端开发服务器 (端口 3000)
npm run dev
```

### 4. 生产环境部署

#### 构建
```bash
npm run build
```

#### 服务器端配置
对于生产环境，您需要：

1. **编译 TypeScript：**
   ```bash
   npx tsc server.ts --lib es2020 --module es2020 --target es2020 --outDir dist
   ```

2. **启动服务器：**
   ```bash
   node dist/server.js
   ```

3. **设置反向代理（nginx 例子）：**
   ```nginx
   upstream backend {
     server localhost:5000;
   }
   
   server {
     listen 80;
     server_name yourdomain.com;
   
     # 后端 API
     location /api/ {
       proxy_pass http://backend/api/;
       proxy_http_version 1.1;
       proxy_set_header Connection "";
       proxy_set_header X-Real-IP $remote_addr;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     }
   
     # 前端
     location / {
       root /path/to/dist;
       try_files $uri /index.html;
     }
   }
   ```

## 数据库 RLS 策略更新

由于前端不再直接访问数据库，某些 RLS 策略可以更宽松：

```sql
-- app_units: 保持公开读取
create policy "Public read app_units" on app_units 
  for select using (true);
create policy "API update app_units" on app_units 
  for update using (current_setting('role') = 'service_role');

-- user_progress: 服务器可以代理读取和写入
create policy "API read all progress" on user_progress 
  for select using (current_setting('role') = 'service_role');
create policy "API update own progress" on user_progress 
  for update using (current_setting('role') = 'service_role');
```

## 故障排查

### 问题1：前端无法连接到 API
**症状：** `Failed to fetch` 错误

**解决：**
- 确保后端服务器在运行：`npm run dev:server`
- 检查 `.env` 中的 `VITE_API_URL` 是否正确
- 检查防火墙是否阻止了 5000 端口

### 问题2：认证失败（401 Unauthorized）
**症状：** API 返回 401 错误

**解决：**
- 确保 `SUPABASE_JWT_SECRET` 与 Supabase 设置一致
- 用户必须先在前端登录
- 检查后端日志输出

### 问题3：跨域问题（CORS）
**症状：** 浏览器控制台 CORS 错误

**解决：**
- 后端已配置 CORS 允许所有源，如需限制请修改：
  ```typescript
  app.use(cors({
    origin: ['https://yourdomain.com', 'http://localhost:3000']
  }));
  ```

## 前后端通信流程示例

### 用户获取进度
```
1. 前端: fetch('http://localhost:5000/api/user/progress', {
     headers: { 'Authorization': 'Bearer <JWT_TOKEN>' }
   })

2. 服务器: 验证 JWT token ✓

3. 服务器: 向 Supabase 发送请求
   SELECT data FROM user_progress WHERE user_id = ?

4. Supabase: 返回用户数据

5. 服务器: 返回给前端
   { data: { xp: 100, hearts: 5, ... } }
```

## 总结

这个升级使应用更加稳定和高效。所有数据操作都通过 API 层进行，避免了客户端的网络问题。如有问题，请查看服务器日志输出。
