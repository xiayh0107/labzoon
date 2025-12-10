# 贡献指南

感谢您对 LabZoon 项目的关注！我们欢迎所有形式的贡献，包括但不限于：

- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码修复
- 🌐 翻译本地化内容

## 开发环境设置

### 前置条件

- Node.js 18+
- npm 或 yarn
- Git

### 设置步骤

1. **Fork 项目**
   - 点击 GitHub 页面右上角的 "Fork" 按钮
   - 这将在您的账户下创建项目副本

2. **克隆您的 Fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/labzoon.git
   cd labzoon
   ```

3. **添加上游仓库**
   ```bash
   git remote add upstream https://github.com/original-owner/labzoon.git
   ```

4. **安装依赖**
   ```bash
   npm install
   ```

5. **配置环境变量**
   ```bash
   cp .env.example .env
   # 编辑 .env 文件，填入必要的配置
   ```

6. **启动开发服务器**
   ```bash
   npm run dev
   ```

7. **验证环境**
   - 访问 http://localhost:5173
   - 确保应用正常运行

## 开发工作流

### 1. 创建分支

在开始开发前，创建一个新分支：

```bash
# 确保在最新的 main 分支
git checkout main
git pull upstream main

# 创建新分支
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/your-bug-fix
```

### 2. 开发和提交

遵循我们的提交信息规范：

```bash
# 格式：<类型>(<范围>): <描述>
# 类型：feat, fix, docs, style, refactor, test, chore

git add .
git commit -m "feat(auth): add social login support"
```

### 3. 推送分支

```bash
git push origin feature/your-feature-name
```

### 4. 创建 Pull Request

- 访问 GitHub 上的 Fork 页面
- 点击 "New pull request"
- 填写 PR 描述，确保包含：
  - 变更概述
  - 相关 Issue 编号
  - 测试步骤
  - 截图（如果适用）

### 5. 代码审查

- 我们的团队会审查您的 PR
- 可能会请求修改
- 及时响应审查意见

## 代码规范

### TypeScript

- 使用 TypeScript 进行类型定义
- 避免使用 `any` 类型
- 使用接口定义对象结构

```typescript
// ✅ 好的示例
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

const getUser = (id: string): Promise<User> => {
  // 实现
};

// ❌ 避免这样做
const getUser = (id): Promise<any> => {
  // 实现
};
```

### React 组件

- 使用函数组件和 Hooks
- 遵循单一职责原则
- 组件名称使用 PascalCase

```tsx
// ✅ 好的示例
interface UserCardProps {
  user: User;
  onClick?: (user: User) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onClick }) => {
  return (
    <div className="user-card" onClick={() => onClick?.(user)}>
      <h3>{user.email}</h3>
    </div>
  );
};

export default UserCard;
```

### 文件组织

```
src/
├── components/         # 可复用组件
│   ├── common/        # 通用组件
│   └── features/      # 功能特定组件
├── hooks/            # 自定义 Hooks
├── types/            # 类型定义
├── utils/            # 工具函数
└── services/         # API 服务
```

### CSS/样式

- 使用 Tailwind CSS
- 遵循组件化样式方法
- 响应式设计优先

```tsx
// ✅ 好的示例
<div className="flex flex-col sm:flex-row gap-4 p-4 bg-white rounded-lg shadow">
  <h2 className="text-xl font-bold text-gray-800">Title</h2>
  <p className="text-gray-600">Description</p>
</div>
```

## 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

### 编写测试

- 使用 Jest 和 React Testing Library
- 测试用户行为而非实现细节
- 保持测试简单可读

```tsx
// 示例测试
import { render, screen, fireEvent } from '@testing-library/react';
import UserCard from './UserCard';

describe('UserCard', () => {
  const mockUser = {
    id: '1',
    email: 'test@example.com',
    createdAt: new Date()
  };

  it('renders user email', () => {
    render(<UserCard user={mockUser} />);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<UserCard user={mockUser} onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('test@example.com'));
    expect(handleClick).toHaveBeenCalledWith(mockUser);
  });
});
```

## 提交 Pull Request 前的检查清单

在提交 PR 前，请确保：

- [ ] 代码通过所有测试
- [ ] 新功能有对应的测试
- [ ] 文档已更新（如果需要）
- [ ] 提交信息遵循规范
- [ ] 没有引入 linting 错误
- [ ] 应用在本地正常运行

运行以下命令检查：

```bash
# 运行测试
npm test

# 检查代码风格
npm run lint

# 构建项目
npm run build
```

## 报告 Bug

发现 Bug？请通过以下步骤报告：

1. **检查现有 Issues**
   - 搜索是否已有相关报告
   - 如果有，请评论补充信息

2. **创建新 Issue**
   - 使用 Bug Report 模板
   - 提供详细信息和复现步骤

3. **Bug Report 模板**

```markdown
**Bug 描述**
简洁明了地描述 Bug

**复现步骤**
1. 进入 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

**期望行为**
描述您期望发生的行为

**截图**
如果适用，添加截图

**环境信息**
- OS: [例如 iOS]
- Browser [例如 chrome, safari]
- Version [例如 22]

**额外信息**
添加任何其他关于问题的信息
```

## 功能请求

提出新功能建议：

1. **检查现有 Issues**
   - 搜索是否已有相关建议
   - 如果有，请点赞或评论

2. **创建新 Issue**
   - 使用 Feature Request 模板
   - 详细描述功能需求和使用场景

3. **Feature Request 模板**

```markdown
**功能描述**
清晰简洁地描述您想要的功能

**问题解决**
这个功能解决了什么问题？

**建议的解决方案**
描述您希望如何实现这个功能

**替代方案**
描述您考虑过的其他解决方案

**额外信息**
添加任何其他相关信息
```

## 文档贡献

我们欢迎以下类型的文档贡献：

- 改进 README
- 添加 API 文档
- 创建教程
- 翻译文档

文档文件位于：

- `docs/` - 详细文档
- `README.md` - 项目概述
- 组件内的 JSDoc 注释

## 行为准则

请阅读并遵守我们的 [行为准则](CODE_OF_CONDUCT.md)。我们致力于为每个人提供友好、安全和欢迎的环境。

## 获得帮助

如果您有任何问题或需要帮助：

1. 查看项目文档
2. 搜索现有 Issues
3. 创建新的 Discussion
4. 联系维护者

## 认可贡献者

我们使用 [All Contributors](https://allcontributors.org/) 规范认可贡献者。贡献类型包括：

- 💻 代码
- 📖 文档
- 🐛 Bug 报告
- 💡 想法
- 🤔 问答
- 🎨 设计
- 📢 推广

## 发布流程

项目维护者负责版本发布：

1. 更新版本号
2. 更新 CHANGELOG
3. 创建 Git 标签
4. 发布到 npm（如果适用）
5. 创建 GitHub Release

## 安全

发现安全漏洞？请不要在公共 Issue 中报告。请发送邮件至 [security@example.com]。

## 再次感谢

您的贡献使 LabZoon 变得更好！无论贡献大小，我们都真诚地感谢您的时间和精力。

---

如果您有其他问题或建议，请随时联系我们。