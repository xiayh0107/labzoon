# LabZoon - 实验动物学学习平台

一个基于 AI 的 Duolingo 风格学习应用，专为医学实验动物学课程设计。

## 功能特点

- 🎯 AI 生成的互动测验题目
- 📚 结构化课程内容管理
- 🏆 游戏化学习进度追踪
- 👥 用户管理与排行榜
- 🔐 Supabase 后端支持

## 快速开始

### 环境要求

- Node.js 18+
- Docker & Docker Compose (可选，用于容器化部署)

### 配置环境变量

1. 复制环境变量模板：
   ```bash
   cp .env.example .env
   ```

2. 编辑 `.env` 文件，填写必要的配置：
   ```bash
   # Supabase 配置 (必填)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

   # AI API 配置
   VITE_GEMINI_API_KEY=your-gemini-api-key
   # 或使用 OpenAI
   VITE_OPENAI_API_KEY=your-openai-api-key
   ```

### 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

应用将在 http://localhost:3000 启动。

### Docker 部署

#### 使用 Docker Compose (推荐)

```bash
# 构建并启动生产环境
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

#### 开发模式 (带热重载)

```bash
docker-compose --profile dev up labzoon-dev
```

#### 手动 Docker 构建

```bash
# 构建镜像
docker build \
  --build-arg VITE_SUPABASE_URL=your-url \
  --build-arg VITE_SUPABASE_ANON_KEY=your-key \
  --build-arg VITE_GEMINI_API_KEY=your-api-key \
  -t labzoon .

# 运行容器
docker run -d -p 3000:80 --name labzoon labzoon
```

## 项目结构

```
labzoon/
├── components/          # React 组件
├── docker/              # Docker 配置文件
│   └── nginx.conf       # Nginx 配置
├── api.ts               # AI API 封装
├── supabase.ts          # Supabase 客户端
├── types.ts             # TypeScript 类型定义
├── App.tsx              # 主应用组件
├── Dockerfile           # Docker 构建文件
├── docker-compose.yml   # Docker Compose 配置
├── .env.example         # 环境变量模板
└── vite.config.ts       # Vite 配置
```

## 技术栈

- **前端**: React 19, TypeScript, Vite
- **样式**: TailwindCSS (内联)
- **后端**: Supabase (认证 + 数据库)
- **AI**: Google Gemini / OpenAI
- **部署**: Docker + Nginx

## 开源协议

MIT License
