# HuLa 前端项目代码清理报告

> 生成日期：2026-03-25
> 项目路径：/Users/ljf/Desktop/hu/hula

---

## 一、清理结果汇总

| 类别 | 数量 | 处理建议 |
|------|------|----------|
| 空目录 | 2 | 可删除 |
| 未使用服务文件 | 0 | - |
| 未使用组件 | 5 | 保留（路由引用） |
| 死代码 TODO | 32+ | 待处理 |

---

## 二、详细发现

### 2.1 空目录（可删除）

```bash
src/components/templates/                           # 空目录
src/services/matrix/test/categories/                 # 空目录
```

### 2.2 TrendRadar 相关文件（保留）

| 路径 | 说明 |
|------|------|
| `src/views/trendradar/TrendRadarView.vue` | 路由 `/trendradar` 引用 |
| `src/components/trendradar/NewsCard.vue` | 路由组件依赖 |
| `src/components/trendradar/SearchPanel.vue` | 路由组件依赖 |
| `src/components/trendradar/TrendingPanel.vue` | 路由组件依赖 |
| `src/services/trendradar/TrendRadarService.ts` | AI 服务 |

**状态**: 保留 - 通过路由 `/trendradar` 可访问

### 2.3 OpenClaw 相关文件（保留）

| 路径 | 说明 |
|------|------|
| `src/views/openclaw/OpenClawView.vue` | 路由 `/openclaw` 引用 |
| `src/components/openclaw/ConnectionStatus.vue` | 路由组件依赖 |
| `src/components/openclaw/ModelSelector.vue` | 路由组件依赖 |
| `src/services/openclaw/OpenClawService.ts` | AI 服务 |

**状态**: 保留 - 通过路由 `/openclaw` 可访问

### 2.4 路由配置（保留）

```typescript
// src/router/index.ts
{ path: '/trendradar', component: () => import('@/views/trendradar/TrendRadarView.vue') }
{ path: '/openclaw', component: () => import('@/views/openclaw/OpenClawView.vue') }
```

### 2.5 未使用工具类（正在使用）

| 文件 | 使用位置 |
|------|----------|
| `MacSelectionGuard.ts` | `ChatHeader.vue`, `renderMessage/index.vue` |
| `CoordinateTransform.ts` | `useGeolocation.ts`, `mapApi.ts` |
| `Canvas2Dom.ts` | `ChatHeader.vue` |

---

## 三、TODO 待处理清单

共发现 **32+ 个** TODO 标记，按优先级分类：

### 高优先级

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/services/tauriCommand.ts` | 109 | Matrix SDK 登录后初始化连接 |
| `src/hooks/useMessage.ts` | 99 | 使用隐藏会话接口 |
| `src/hooks/useMsgInput.ts` | 454 | 切换会话时暂存输入框内容 |

### 中优先级

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/layout/index.vue` | 520 | Matrix SDK 消息监听器设置 |
| `src/hooks/useWebRtc.ts` | 11 | Matrix VoIP 集成 |
| `src/composables/useErrorHandler.ts` | 70 | 接入错误上报服务 |

### 低优先级

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/components/rightBox/MsgInput.vue` | 818 | 独立窗口聊天功能 |
| `src/views/Notify.vue` | 117, 193 | 托盘图标闪烁问题 |
| `src/mobile/...` | - | 移动端相关 TODO |

---

## 四、清理操作

### 4.1 删除空目录

```bash
rmdir src/components/templates
rmdir src/services/matrix/test/categories
```

### 4.2 保留项确认

- **TrendRadar**: 路由 `/trendradar` 有效
- **OpenClaw**: 路由 `/openclaw` 有效  
- **AI 服务**: 机器人聊天插件使用
- **工具类**: 均有实际使用

---

## 五、结论

| 类别 | 结论 |
|------|------|
| TrendRadar 代码 | **保留** - 路由可访问，非死代码 |
| OpenClaw 代码 | **保留** - 路由可访问，非死代码 |
| 空目录 | 可删除 2 个 |
| TODO 标记 | 32+ 个待处理 |
| 未使用工具 | 无 |

**总体评估**: 项目代码结构健康，未发现大规模冗余代码。TrendRadar 和 OpenClaw 为有效路由功能，非废弃代码。