# LabZoon - AI驱动的医学实验动物学学习平台

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19.2.0-blue)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF)](https://vitejs.dev/)

一个基于 AI 的 Duolingo 风格学习应用，专为医学实验动物学课程设计。提供互动式学习体验、智能题目生成和个性化学习路径。

## ✨ 功能特点

### 🎯 核心学习功能
- **AI 生成的互动测验题目** - 支持多种题型（单选、多选、判断、填空）
- **结构化课程内容管理** - 单元-课程-题目的层级结构
- **游戏化学习进度追踪** - 经验值、连续学习天数、星级评价
- **实时排行榜** - 激励用户竞争学习

### 📚 私人题库系统
- **多题库管理** - 每个用户可创建多个私人题库
- **智能章节组织** - 按主题、课程或兴趣组织学习内容
- **AI 题目生成** - 输入学习材料，自动生成高质量题目
- **个性化练习** - 像刷公共课程一样刷自己的私人题目

### 🔧 管理功能
- **完整的后台管理** - 用户管理、题库管理、数据备份
- **多种AI服务支持** - Google Gemini 和 OpenAI 集成
- **数据分析** - 学习进度统计和用户行为分析

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm 或 yarn
- Docker & Docker Compose (可选，用于容器化部署)
- Supabase 账号 (用于数据库和认证)

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/yourusername/labzoon.git
   cd labzoon
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.example .env
   ```
   
   编辑 `.env` 文件，填写必要的配置：
   ```bash
   # Supabase 配置 (必填)
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

   # AI API 配置 (至少配置一个)
   VITE_GEMINI_API_KEY=your-gemini-api-key
   VITE_OPENAI_API_KEY=your-openai-api-key
   ```

4. **初始化数据库**
   - 登录 Supabase Dashboard
   - 在 SQL Editor 中运行 `sql/schema_v2.sql` 脚本
   - 根据需要运行 `sql/user_question_banks.sql` 启用私人题库功能

5. **启动开发服务器**
   ```bash
   npm run dev
   ```
   
   应用将在 http://localhost:5173 启动。

## 🐳 Docker 部署

### 使用 Docker Compose (推荐)

```bash
# 构建并启动生产环境
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 开发模式 (带热重载)

```bash
docker-compose --profile dev up labzoon-dev
```

### 手动 Docker 构建

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

## 📁 项目结构

```
labzoon/
├── components/          # React 组件
│   ├── AdminPanel.tsx  # 管理员面板
│   ├── LessonSession.tsx # 学习会话
│   ├── UserQuestionBanks.tsx # 用户私人题库
│   └── ...
├── hooks/              # 自定义 React Hooks
│   ├── useApp.ts       # 应用状态管理
│   ├── useToast.ts     # Toast 通知
│   └── useAPI.ts       # API 调用封装
├── server/             # 服务器端代码
├── sql/                # 数据库脚本
│   ├── schema_v2.sql   # 数据库结构
│   └── user_question_banks.sql # 私人题库表
├── api.ts              # AI API 封装
├── apiClient.ts        # API 客户端
├── supabase.ts         # Supabase 客户端
├── types.ts            # TypeScript 类型定义
├── App.tsx             # 主应用组件
├── Dockerfile          # Docker 构建文件
├── docker-compose.yml  # Docker Compose 配置
├── .env.example        # 环境变量模板
└── vite.config.ts      # Vite 配置
```

## 🛠 技术栈

### 前端
- **React 19.2.0** - 现代化 UI 框架
- **TypeScript 5.8.2** - 类型安全的 JavaScript
- **Vite 6.2.0** - 快速构建工具
- **TailwindCSS 3.4.1** - 实用优先的 CSS 框架

### 后端
- **Supabase** - 认证、数据库和实时订阅
- **Express.js 4.18.2** - API 服务器
- **JWT** - 安全认证

### AI 集成
- **Google Gemini** - AI 内容生成
- **OpenAI GPT** - 备用 AI 服务

### 开发工具
- **ESLint** - 代码质量检查
- **Docker** - 容器化部署
- **Nginx** - 生产环境服务器

## 📖 使用指南

### 学生使用流程

1. **注册/登录** - 使用邮箱注册或直接登录
2. **选择课程** - 浏览可用的学习单元和课程
3. **开始学习** - 点击课程进入学习会话
4. **完成测验** - 回答 AI 生成的题目，获得星级评价
5. **查看进度** - 在个人面板查看学习进度和成就

### 创建私人题库

1. 点击侧边栏的"我的题库"
2. 点击"创建题库"新建题库
3. 在题库中添加章节
4. 选择添加方式：
   - **手动添加** - 逐题创建
   - **AI 生成** - 输入学习材料自动生成
5. 点击"开始练习"开始学习

### 管理员功能

1. **用户管理** - 查看和管理注册用户
2. **题库管理** - 管理公共题库和课程内容
3. **AI 生成器** - 批量生成高质量题目
4. **数据备份** - 备份和恢复用户数据

## 🔧 配置说明

### Supabase 配置

1. 创建新的 Supabase 项目
2. 在 Authentication > Settings 中配置：
   - 禁用"Enable email confirmations"（开发环境）
   - 添加允许的站点 URL

3. 在 Database 中运行 SQL 脚本：
   ```bash
   # 在 Supabase SQL Editor 中运行
   sql/schema_v2.sql
   sql/user_question_banks.sql
   ```

4. 获取项目 URL 和 API Key，填入 `.env` 文件

### AI API 配置

#### Google Gemini
1. 访问 [Google AI Studio](https://aistudio.google.com/)
2. 创建 API Key
3. 添加到 `.env` 文件：
   ```bash
   VITE_GEMINI_API_KEY=your-gemini-api-key
   ```

#### OpenAI (可选)
1. 访问 [OpenAI API](https://platform.openai.com/)
2. 创建 API Key
3. 添加到 `.env` 文件：
   ```bash
   VITE_OPENAI_API_KEY=your-openai-api-key
   ```

## 🤝 贡献指南

我们欢迎所有形式的贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细信息。

### 开发环境搭建

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

### 代码规范

- 使用 TypeScript 进行类型定义
- 遵循 ESLint 配置
- 组件命名使用 PascalCase
- 提交信息使用约定式提交格式

## 📄 许可证

本项目采用 [MIT 许可证](LICENSE)。

## 🙏 致谢

- [React](https://reactjs.org/) - UI 框架
- [Supabase](https://supabase.com/) - 后端服务
- [TailwindCSS](https://tailwindcss.com/) - CSS 框架
- [Vite](https://vitejs.dev/) - 构建工具
- [Lucide](https://lucide.dev/) - 图标库

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 创建 [Issue](https://github.com/yourusername/labzoon/issues)
- 发送邮件至 your-email@example.com

---

⭐ 如果这个项目对你有帮助，请给我们一个 Star！