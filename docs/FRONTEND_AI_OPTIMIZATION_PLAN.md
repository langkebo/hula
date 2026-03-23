# HuLa 前端 AI 功能优化方案

> 版本: v1.0
> 更新日期: 2026-03-23
> 状态: 待实施

---

## 1. 背景与目标

### 1.1 现状分析

根据 `hula-ai-connection-plan.md` 和 `功能实现清单.md` 的分析，当前 HuLa 前端存在以下问题：

| 问题 | 说明 | 优先级 |
|------|------|--------|
| Chatbot 页面功能混乱 | 未连接 TrendRadar 时显示通用 AI 对话 | 🔴 高 |
| HuLa 小管家界面冗余 | 混合了 OpenClaw 和后端 AI 功能，交互复杂 | 🔴 高 |
| 界面与后端功能不匹配 | 后端已实现 MCP 协议，但前端未对接 | 🟡 中 |

### 1.2 优化目标

1. **Chatbot 页面** → 专用 TrendRadar 资讯页面
   - 连接 TrendRadar MCP 服务
   - 显示热点新闻推送
   - 资讯搜索与订阅

2. **HuLa 小管家** → OpenClawX 联动界面
   - 直连本地 OpenClawX 应用
   - 类似飞书与 OpenClaw 的对话体验
   - 简洁高效的交互界面

3. **清理冗余** → 删除无关功能
   - 移除未使用的 AI Provider 选项
   - 清理旧版 Robot 插件代码
   - 简化设置页面

---

## 2. 功能调整方案

### 2.1 Chatbot 页面 → TrendRadar 资讯页面

#### 2.1.1 功能定位

**修改前**：通用 AI 对话界面（支持 OpenClaw / HuLa 后端切换）

**修改后**：TrendRadar 专属资讯助手页面

#### 2.1.2 核心功能

| 功能 | 说明 |
|------|------|
| 热点新闻推送 | 显示 TrendRadar 获取的各大平台热点 |
| 资讯搜索 | 关键词搜索新闻资讯 |
| 趋势话题 | 展示当前热度飙升的话题 |
| RSS 订阅 | 关注垂直领域深度文章 |
| 话题分析 | 对特定话题进行趋势分析 |

#### 2.1.3 实现思路

```
现有资源复用：
├── TrendRadarService.ts          → MCP 协议调用
├── Robot/views/Chat.vue          → 页面框架
└── 需要新建:
    ├── components/trendradar/NewsCard.vue        → 新闻卡片组件
    ├── components/trendradar/TrendingPanel.vue    → 趋势话题面板
    ├── components/trendradar/SearchPanel.vue     → 搜索结果面板
    └── views/trendradar/TrendRadarView.vue      → 主页面
```

### 2.2 HuLa 小管家 → OpenClawX 联动界面

#### 2.2.1 功能定位

**修改前**：混合 AI 服务界面（包含模型选择、Provider 切换）

**修改后**：直连 OpenClawX 的对话界面（类似飞书）

#### 2.2.2 核心功能

| 功能 | 说明 |
|------|------|
| OpenClawX 连接 | 检测并连接本地 OpenClawX 应用 |
| 直连对话 | 类似飞书，消息直接发送到 OpenClawX 处理 |
| 模型选择 | 显示 OpenClawX 可用模型列表 |
| 流式响应 | SSE 流式输出 AI 响应 |
| 连接状态 | 显示连接状态和错误提示 |

#### 2.2.3 实现思路

```
现有资源复用：
├── OpenClawService.ts            → OpenClaw 连接逻辑
├── Robot/views/Chat.vue           → 可参考布局
└── 需要新建:
    ├── components/openclaw/ConnectionStatus.vue  → 连接状态组件
    ├── components/openclaw/ModelSelector.vue    → 模型选择器
    ├── composables/useOpenClawX.ts              → OpenClawX 联动逻辑
    └── views/openclaw/OpenClawView.vue         → 主页面
```

### 2.3 冗余内容清理

#### 2.3.1 删除的组件

| 组件路径 | 删除原因 |
|---------|---------|
| `plugins/robot/views/Welcome.vue` | 未使用 |
| `plugins/robot/views/ImageGeneration.vue` | 已迁移到单独功能 |
| `plugins/robot/views/VideoGeneration.vue` | 已迁移到单独功能 |
| `plugins/robot/views/*.vue` (除 Chat.vue) | 冗余的 AI 生成界面 |

#### 2.3.2 清理的配置项

| 配置项 | 清理原因 |
|-------|---------|
| AI Provider 切换 | 仅保留 OpenClawX |
| HuLa 后端 AI 选项 | 由后端直接处理 |
| 多模型选择 | OpenClawX 管理 |

---

## 3. UI 设计规范

### 3.1 设计原则

参考 `hula-ai-connection-plan.md` 中的交互规范：

1. **一致性** - 保持与 HuLa 整体设计语言一致
2. **简洁性** - 移除不必要的元素，突出核心功能
3. **反馈性** - 每个操作都有明确的 UI 反馈
4. **流畅性** - 动画和转场流畅自然

### 3.2 主题支持

| 主题 | 背景色 | 文字色 | 强调色 |
|------|--------|--------|--------|
| 深色 (dark) | `#1a1a1a` | `#e3e3e3` | `#13987f` |
| 浅色 (light) | `#ffffff` | `#333333` | `#13987f` |

### 3.3 TrendRadar 资讯页面 UI

#### 3.3.1 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│ [返回]    TrendRadar 资讯助手              [连接状态] [刷新] │
├──────────┬──────────────────────────────────────────────────┤
│          │                                                  │
│  导航栏   │              主内容区                            │
│          │                                                  │
│ • 热点   │  ┌─────────────────────────────────────────┐   │
│ • 搜索   │  │         热点新闻列表 / 搜索结果            │   │
│ • 趋势   │  │                                          │   │
│ • 订阅   │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │   │
│ • 分析   │  │  │ NewsCard│ │ NewsCard│ │ NewsCard│   │   │
│          │  │  └─────────┘ └─────────┘ └─────────┘   │   │
│          │  │                                          │   │
│          │  └─────────────────────────────────────────┘   │
│          │                                                  │
├──────────┴──────────────────────────────────────────────────┤
│ [输入框: 搜索关键词...]                              [发送]   │
└─────────────────────────────────────────────────────────────┘
```

#### 3.3.2 组件设计

**NewsCard (新闻卡片)**
```
┌───────────────────────────────┐
│ [平台图标] [来源] [时间]      │
│ 标题标题标题标题标题标题标题   │
│ 摘要摘要摘要摘要摘要摘要...    │
│ [标签1] [标签2] [查看详情 →] │
└───────────────────────────────┘
```

**状态设计**
- 加载中：`n-spin` + "正在获取资讯..."
- 空状态：插画 + "暂无相关资讯"
- 错误状态：红色提示 + 重试按钮
- 成功加载：卡片列表渐入动画

### 3.4 OpenClawX 联动界面 UI

#### 3.4.1 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│ [返回]    OpenClawX                 [连接状态] [新对话]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    对话区域                                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    AI 助手                          │   │
│  │  你好！我是 OpenClawX，请问有什么可以帮助你的？     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│                                         ┌─────────────────┐ │
│  我想了解一下最新的 AI 技术进展...        │                 │ │
│                                         │    用户消息     │ │
│                                         └─────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [模型: GPT-4 ▼]  [输入框...]                        [发送] │
└─────────────────────────────────────────────────────────────┘
```

#### 3.4.2 连接状态设计

| 状态 | 颜色 | 图标 | 说明 |
|------|------|------|------|
| 已连接 | success (绿色) | `n-icon: check-circle` | 可正常使用 |
| 连接中 | warning (黄色) | `n-icon: loading` | 正在连接 |
| 未连接 | error (红色) | `n-icon: close-circle` | 检查 OpenClawX 是否运行 |
| 连接失败 | error (红色) | `n-icon: alert-circle` | 显示错误信息 |

### 3.5 动画规范

| 动画 | 时长 | 缓动函数 | 说明 |
|------|------|----------|------|
| 页面转场 | 300ms | ease-in-out | 页面切换动画 |
| 卡片加载 | 200ms | ease-out | 列表项渐入 |
| 按钮反馈 | 100ms | ease | 点击缩放 0.95 |
| 流式文字 | - | - | 逐字显示，无动画 |
| 加载状态 | - | linear | 循环旋转 |

---

## 4. 技术实现

### 4.1 文件结构

```
src/
├── views/
│   ├── trendradar/
│   │   └── TrendRadarView.vue      # TrendRadar 资讯页面
│   └── openclaw/
│       └── OpenClawView.vue        # OpenClawX 联动页面
├── components/
│   ├── trendradar/
│   │   ├── NewsCard.vue            # 新闻卡片
│   │   ├── TrendingPanel.vue       # 趋势话题面板
│   │   ├── SearchPanel.vue         # 搜索结果面板
│   │   ├── RssSubscription.vue     # RSS 订阅面板
│   │   └── TopicAnalysis.vue       # 话题分析面板
│   └── openclaw/
│       ├── ConnectionStatus.vue     # 连接状态
│       ├── ModelSelector.vue       # 模型选择器
│       └── ChatMessage.vue         # 消息气泡
├── composables/
│   ├── useTrendRadar.ts            # TrendRadar 逻辑
│   └── useOpenClawX.ts            # OpenClawX 联动逻辑
└── services/
    └── trendradar/
        └── TrendRadarService.ts    # MCP 调用封装
```

### 4.2 核心组件 API

#### TrendRadarView.vue

```typescript
// Props
interface Props {
  // 无需 props，通过 composable 获取数据
}

// Emits
interface Emits {
  (event: 'back'): void
  (event: 'error', message: string): void
}
```

#### OpenClawView.vue

```typescript
// Props
interface Props {
  // 无需 props，通过 composable 获取数据
}

// Emits
interface Emits {
  (event: 'back'): void
  (event: 'newChat'): void
}
```

#### useTrendRadar.ts

```typescript
interface TrendRadarOptions {
  mcpUrl?: string  // 默认: 'http://127.0.0.1:3333/mcp'
  cacheTimeout?: number  // 缓存时间，默认 10 分钟
}

export function useTrendRadar(options?: TrendRadarOptions) {
  // 连接状态
  const isConnected = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // 新闻数据
  const newsList = ref<NewsItem[]>([])
  const trendingTopics = ref<Topic[]>([])
  const searchResults = ref<NewsItem[]>([])

  // 方法
  async function connect(): Promise<void>
  async function fetchLatestNews(limit?: number): Promise<void>
  async function searchNews(keyword: string, limit?: number): Promise<void>
  async function fetchTrendingTopics(): Promise<void>
  async function analyzeTopic(topic: string): Promise<string>

  return {
    isConnected,
    isLoading,
    error,
    newsList,
    trendingTopics,
    searchResults,
    connect,
    fetchLatestNews,
    searchNews,
    fetchTrendingTopics,
    analyzeTopic
  }
}
```

#### useOpenClawX.ts

```typescript
export function useOpenClawX() {
  // 连接状态
  const connectionStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const errorMessage = ref<string | null>(null)

  // 可用模型
  const availableModels = ref<Model[]>([])
  const currentModel = ref<string | null>(null)

  // 消息
  const messages = ref<Message[]>([])

  // 方法
  async function connect(): Promise<void>
  async function disconnect(): Promise<void>
  async function sendMessage(content: string): Promise<void>
  function selectModel(modelId: string): void

  return {
    connectionStatus,
    errorMessage,
    availableModels,
    currentModel,
    messages,
    connect,
    disconnect,
    sendMessage,
    selectModel
  }
}
```

### 4.3 API 调用规范

#### TrendRadar MCP 调用

参考 `hula-ai-connection-plan.md` 中的规范：

```typescript
// MCP 请求格式
interface McpRequest {
  jsonrpc: '2.0'
  method: 'tools/call'
  params: {
    name: string
    arguments: Record<string, any>
  }
  id: number
}

// 工具列表
type McpTool =
  | 'get_latest_news'
  | 'search_news'
  | 'get_trending_topics'
  | 'get_latest_rss'
  | 'analyze_topic_trend'
```

#### OpenClawX 连接

```typescript
// 连接配置
interface OpenClawXConfig {
  gatewayUrl: string  // 默认: 'http://localhost:18789'
  timeout?: number
}

// 消息格式
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
```

---

## 5. 实施计划

### 5.1 第一阶段：TrendRadar 资讯页面 (3天)

| 任务 | 产出物 | 时间 |
|------|--------|------|
| 创建 TrendRadarService | MCP 调用封装 | 0.5天 |
| 创建 useTrendRadar composable | 状态管理逻辑 | 0.5天 |
| 实现 NewsCard 组件 | 卡片组件 | 0.5天 |
| 实现 TrendRadarView 主页面 | 页面布局 | 1天 |
| 实现搜索和趋势功能 | 搜索面板、趋势面板 | 0.5天 |

### 5.2 第二阶段：OpenClawX 联动界面 (2天)

| 任务 | 产出物 | 时间 |
|------|--------|------|
| 创建 useOpenClawX composable | 连接和消息逻辑 | 0.5天 |
| 实现 ConnectionStatus 组件 | 连接状态显示 | 0.5天 |
| 实现 ModelSelector 组件 | 模型选择器 | 0.5天 |
| 实现 OpenClawView 主页面 | 页面布局 | 0.5天 |

### 5.3 第三阶段：路由和入口调整 (1天)

| 任务 | 说明 | 时间 |
|------|------|------|
| 更新路由配置 | 添加新页面路由 | 0.25天 |
| 调整侧边栏入口 | 修改图标和链接 | 0.25天 |
| 删除旧 Robot 插件 | 移除冗余文件 | 0.5天 |

### 5.4 第四阶段：测试和优化 (1天)

| 任务 | 说明 | 时间 |
|------|------|------|
| 功能测试 | 验证各功能正常 | 0.5天 |
| UI 适配 | 主题和响应式 | 0.25天 |
| 性能优化 | 加载和动画优化 | 0.25天 |

---

## 6. 验收标准

### 6.1 功能验收

- [ ] TrendRadarView 页面正常显示热点新闻
- [ ] 搜索功能返回正确结果
- [ ] 趋势话题正常展示
- [ ] OpenClawView 成功连接本地 OpenClawX
- [ ] 消息发送和接收正常
- [ ] 模型选择功能正常

### 6.2 UI 验收

- [ ] 深色/浅色主题正常切换
- [ ] 动画流畅无卡顿
- [ ] 加载状态显示正确
- [ ] 错误状态有明确提示
- [ ] 移动端布局正常

### 6.3 代码验收

- [ ] TypeScript 严格模式 0 错误
- [ ] ESLint 0 警告
- [ ] 无冗余代码和文件
- [ ] 组件命名规范一致

---

## 7. 风险与对策

### 7.1 风险

| 风险 | 影响 | 对策 |
|------|------|------|
| TrendRadar 服务不可用 | 功能无法使用 | 添加降级提示，使用本地缓存 |
| OpenClawX 未安装 | 连接失败 | 检测并提示用户安装 |
| MCP 接口变更 | 功能异常 | 版本兼容检测 |

### 7.2 降级方案

当 TrendRadar 不可用时：
- 显示 "资讯服务暂时不可用"
- 提供重试按钮
- 保留上次缓存的数据

当 OpenClawX 不可用时：
- 显示连接状态为 "未连接"
- 提供 OpenClawX 下载链接
- 不阻塞其他功能

---

*文档版本: v1.0*
*生成时间: 2026-03-23*
