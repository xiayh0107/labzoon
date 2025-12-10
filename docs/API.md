# LabZoon API 文档

## 概述

LabZoon 采用三层架构设计，前端通过 Express API 服务器与 Supabase 数据库交互，确保安全性和性能。

## 架构设计

```
浏览器 (React) → API服务器 (Express) → Supabase数据库
```

### 为什么使用 API 中间层？

1. **性能优化** - 避免客户端直连数据库的跨域问题
2. **安全性增强** - 服务端使用 SERVICE_ROLE_KEY，前端不暴露敏感信息
3. **可维护性** - 统一的API接口，便于管理和扩展

## 认证方式

所有 API 请求都需要通过 JWT 令牌进行身份验证。

### 获取令牌

用户通过 Supabase Auth 登录后，会收到 JWT 令牌，该令牌需要包含在所有 API 请求的 Authorization 头中：

```
Authorization: Bearer <your-jwt-token>
```

## API 端点

### 1. 认证相关

#### 登录/注册
```http
POST /api/auth/login
```

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com"
    },
    "session": {
      "access_token": "jwt-token",
      "expires_in": 3600
    }
  }
}
```

#### 登出
```http
POST /api/auth/logout
```

### 2. 用户管理

#### 获取用户信息
```http
GET /api/user/profile
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "created_at": "2023-01-01T00:00:00Z"
  }
}
```

#### 更新用户信息
```http
PUT /api/user/profile
```

**请求体：**
```json
{
  "display_name": "New Display Name",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

### 3. 学习单元和课程

#### 获取所有单元
```http
GET /api/units
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "unit-uuid",
      "title": "实验动物基础知识",
      "description": "学习实验动物的基本概念和分类",
      "color": "blue",
      "order_index": 0,
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

#### 获取单元下的课程
```http
GET /api/units/{unitId}/lessons
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "lesson-uuid",
      "unit_id": "unit-uuid",
      "title": "实验动物分类",
      "order_index": 0,
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

#### 获取课程的挑战/题目
```http
GET /api/lessons/{lessonId}/challenges
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "challenge-uuid",
      "lesson_id": "lesson-uuid",
      "type": "single_choice",
      "question": "实验动物是指什么？",
      "options": [
        "用于科学实验的动物",
        "宠物动物",
        "野生动物"
      ],
      "correct_answer": "用于科学实验的动物",
      "explanation": "实验动物是经过人工培育，用于科学研究、教学、生产的动物。",
      "difficulty": 1,
      "order_index": 0
    }
  ]
}
```

### 4. 用户进度

#### 获取用户学习进度
```http
GET /api/user/progress
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "progress-uuid",
      "user_id": "user-uuid",
      "lesson_id": "lesson-uuid",
      "completed": true,
      "score": 85,
      "stars": 2,
      "attempts": 1,
      "last_attempt": "2023-01-01T00:00:00Z"
    }
  ]
}
```

#### 更新学习进度
```http
POST /api/user/progress
```

**请求体：**
```json
{
  "lesson_id": "lesson-uuid",
  "completed": true,
  "score": 85,
  "stars": 2
}
```

### 5. AI 知识点生成

#### 生成知识点
```http
POST /api/ai/generate-knowledge
```

**请求体：**
```json
{
  "unit_title": "实验动物基础知识",
  "lesson_title": "实验动物分类",
  "difficulty": 2,
  "count": 5
}
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "title": "实验动物的定义",
      "content": "实验动物是指经过人工培育...",
      "type": "text"
    }
  ]
}
```

#### 生成题目
```http
POST /api/ai/generate-challenges
```

**请求体：**
```json
{
  "lesson_title": "实验动物分类",
  "difficulty": 2,
  "types": ["single_choice", "multiple_choice"],
  "count": 5
}
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "type": "single_choice",
      "question": "实验动物是指什么？",
      "options": [
        "用于科学实验的动物",
        "宠物动物",
        "野生动物"
      ],
      "correct_answer": "用于科学实验的动物",
      "explanation": "实验动物是经过人工培育...",
      "difficulty": 2
    }
  ]
}
```

### 6. 管理员功能

#### 获取管理员列表
```http
GET /api/admin/admins
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "admin-uuid",
      "email": "admin@example.com",
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

#### 添加管理员
```http
POST /api/admin/admins
```

**请求体：**
```json
{
  "email": "new-admin@example.com"
}
```

#### 获取所有用户
```http
GET /api/admin/users
```

#### 数据备份
```http
POST /api/admin/backup
```

### 7. 用户私人题库

#### 获取用户的题库列表
```http
GET /api/user/question-banks
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "bank-uuid",
      "user_id": "user-uuid",
      "title": "我的医学题库",
      "description": "包含医学相关题目",
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

#### 创建新题库
```http
POST /api/user/question-banks
```

**请求体：**
```json
{
  "title": "新题库",
  "description": "题库描述"
}
```

#### 获取题库中的题目
```http
GET /api/user/question-banks/{bankId}/questions
```

#### 向题库添加题目
```http
POST /api/user/question-banks/{bankId}/questions
```

**请求体：**
```json
{
  "type": "single_choice",
  "question": "题目内容",
  "options": ["选项1", "选项2", "选项3"],
  "correct_answer": "选项1",
  "explanation": "解释内容",
  "difficulty": 1
}
```

## 错误处理

所有 API 错误响应都遵循统一格式：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息"
  }
}
```

### 常见错误代码

- `UNAUTHORIZED` - 未授权访问
- `FORBIDDEN` - 权限不足
- `NOT_FOUND` - 资源不存在
- `VALIDATION_ERROR` - 请求参数验证失败
- `RATE_LIMIT_EXCEEDED` - 请求频率超限
- `INTERNAL_SERVER_ERROR` - 服务器内部错误

## 限流

API 实施请求限流机制：

- 普通用户：每分钟 100 次请求
- 管理员用户：每分钟 200 次请求
- AI 生成接口：每分钟 10 次请求

## WebSocket 连接

LabZoon 支持实时功能，如排行榜更新和消息推送。

### 连接端点

```
wss://your-domain.com/ws
```

### 认证

连接时需要在查询参数中提供 JWT 令牌：

```
wss://your-domain.com/ws?token=your-jwt-token
```

### 消息格式

```json
{
  "type": "message_type",
  "data": {
    // 消息数据
  }
}
```

### 消息类型

- `leaderboard_update` - 排行榜更新
- `user_status` - 用户状态变化
- `notification` - 系统通知

## SDK 使用示例

### JavaScript/TypeScript

```typescript
import { apiClient } from './apiClient';

// 获取单元列表
const units = await apiClient.fetchUnits();

// 更新用户进度
await apiClient.updateProgress('lesson-uuid', {
  completed: true,
  score: 85,
  stars: 2
});

// 生成知识点
const knowledge = await apiClient.generateKnowledge({
  unitTitle: "实验动物基础知识",
  lessonTitle: "实验动物分类",
  difficulty: 2
});
```

## 版本历史

- **v2.0** - 当前版本，重构了数据库架构和 API
- **v1.0** - 初始版本，基础功能

## 支持

如有 API 使用问题，请通过以下方式联系：

- 创建 GitHub Issue
- 查看项目 Wiki
- 阅读源代码注释