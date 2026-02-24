# HuLa 用户菜单改造开发规格

## 1. 项目概述

### 1.1 背景
基于 `element-web` 项目的用户菜单实现，对 `HuLa` 项目进行改造，实现点击头像后弹出菜单及相关设置页面的完整功能。

### 1.2 目标
- 在保持 HuLa 原有 UI 风格的基础上，实现 element-web 的用户菜单功能
- 支持左键和右键点击头像弹出菜单
- 实现完整的设置页面体系（账户、安全、通知、外观等）
- 适配 Matrix SDK 的功能特性
- 支持桌面端和移动端多端同步

### 1.3 核心原则

**SDK 集成优先原则**：所有能通过 Matrix SDK 实现的功能，必须通过 SDK 实现，禁止重复开发。

## 2. 多端架构设计

### 2.1 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                      Shared Layer (共享层)                       │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Services                                                 │ │
│  │  - MatrixClientService (SDK 封装)                         │ │
│  │  - MatrixRoomService                                      │ │
│  │  - MatrixEventService                                     │ │
│  │  - MatrixCryptoService                                    │ │
│  │  - MatrixMediaService                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Stores (Pinia)                                           │ │
│  │  - userMenu.ts (菜单状态)                                  │ │
│  │  - settingsDialog.ts (设置对话框状态)                      │ │
│  │  - user.ts (用户状态)                                      │ │
│  │  - setting.ts (设置状态)                                   │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Composables                                              │ │
│  │  - useUserMenu.ts (菜单逻辑)                               │ │
│  │  - useSettings.ts (设置逻辑)                               │ │
│  │  - usePlatform.ts (平台检测)                               │ │
│  └───────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│                      Platform Layer (平台层)                     │
│  ┌─────────────────────────────┐ ┌─────────────────────────────┐│
│  │    Desktop (Tauri/Naive UI) │ │    Mobile (Web/Vant)        ││
│  │  - UserMenuDesktop.vue      │ │  - UserMenuMobile.vue       ││
│  │  - SettingsDialog.vue       │ │  - SettingsSheet.vue        ││
│  │  - 系统托盘集成             │ │  - 底部弹出式设置            ││
│  │  - 原生通知                 │ │  - Web Notification         ││
│  └─────────────────────────────┘ └─────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 平台差异处理

| 功能 | 桌面端实现 | 移动端实现 |
|------|-----------|-----------|
| 菜单弹出 | 右侧/下方下拉菜单 | 底部弹出动作面板 |
| 设置页面 | 模态对话框 | 全屏页面/底部弹出 |
| 主题切换 | Tauri API + CSS | CSS prefers-color-scheme |
| 通知 | Tauri 原生通知 | Web Notification API |
| 文件选择 | Tauri 文件对话框 | input file |
| 设备管理 | 完整功能展示 | 简化列表展示 |

## 3. 功能需求

### 3.1 用户菜单功能

#### 3.1.1 头像点击行为

| 平台 | 操作 | 行为 |
|------|------|------|
| 桌面端 | 左键点击 | 在头像右侧/下方弹出菜单（根据面板折叠状态） |
| 桌面端 | 右键点击 | 在鼠标位置弹出菜单 |
| 移动端 | 点击 | 底部弹出动作面板 |

#### 3.1.2 菜单项列表

| 菜单项 | 图标 | 功能 | SDK API | 桌面端 | 移动端 |
|--------|------|------|---------|--------|--------|
| 我的主页 | HomeIcon | 返回主页 | - | ✅ | ✅ |
| 链接新设备 | QrCodeIcon | 显示二维码登录 | `client.generateQRCode()` | ✅ | ❌ |
| 通知 | BellIcon | 通知设置 | `client.setPusher()` | ✅ | ✅ |
| 安全隐私 | LockIcon | 安全设置 | `client.crypto` | ✅ | ✅ |
| 设置 | SettingsIcon | 打开设置 | - | ✅ | ✅ |
| 反馈 | ChatIcon | 打开反馈对话框 | - | ✅ | ✅ |
| 退出登录 | LogoutIcon | 退出登录确认 | `client.logout()` | ✅ | ✅ |

#### 3.1.3 主题快速切换

- 在菜单头部提供主题切换按钮
- 桌面端：使用 Tauri API 检测系统主题
- 移动端：使用 CSS `prefers-color-scheme` 媒体查询
- 支持明/暗主题一键切换

### 3.2 设置页面功能

#### 3.2.1 账户设置页

| 功能 | SDK API | 桌面端 | 移动端 |
|------|---------|--------|--------|
| 头像修改 | `client.setAvatarUrl()` | ✅ 裁剪器 | ✅ 相机/相册 |
| 昵称修改 | `client.setDisplayName()` | ✅ | ✅ |
| 密码修改 | `client.setPassword()` | ✅ | ✅ |
| 邮箱绑定 | `client.addThreePid()` | ✅ | ✅ |
| 手机绑定 | `client.addThreePid()` | ✅ | ✅ |
| 账户注销 | `client.deactivateAccount()` | ✅ | ❌ |

#### 3.2.2 会话管理页

| 功能 | SDK API | 桌面端 | 移动端 |
|------|---------|--------|--------|
| 设备列表 | `client.getDevices()` | ✅ 完整列表 | ✅ 简化列表 |
| 设备重命名 | `client.setDeviceName()` | ✅ | ✅ |
| 设备登出 | `client.deleteDevice()` | ✅ | ✅ |
| 二维码登录 | MSC4108 | ✅ | ❌ |
| 设备验证 | `client.crypto.verifyDevice()` | ✅ | ✅ |

#### 3.2.3 外观设置页

| 功能 | 实现方式 | 桌面端 | 移动端 |
|------|---------|--------|--------|
| 主题选择 | CSS 变量 + Store | ✅ | ✅ |
| 字体大小 | CSS 变量 | ✅ | ✅ |
| 布局模式 | 组件配置 | ✅ | ❌ |
| 消息气泡 | CSS 样式 | ✅ | ✅ |
| 紧凑布局 | CSS 类切换 | ✅ | ❌ |

#### 3.2.4 通知设置页

| 功能 | SDK API | 桌面端 | 移动端 |
|------|---------|--------|--------|
| 桌面通知 | `client.setPusher()` + Tauri/Web API | ✅ 原生 | ✅ Web |
| 通知声音 | 本地音频 | ✅ | ✅ |
| 关键词通知 | `client.setAccountData('m.keyword')` | ✅ | ✅ |
| 会话通知 | `client.setRoomAccountData()` | ✅ | ✅ |

#### 3.2.5 安全隐私页

| 功能 | SDK API | 桌面端 | 移动端 |
|------|---------|--------|--------|
| 加密状态 | `client.crypto` | ✅ | ✅ |
| 恢复密钥 | `client.crypto.backup` | ✅ 完整 | ✅ 简化 |
| 被忽略用户 | `client.setIgnoredUsers()` | ✅ | ✅ |
| 邀请管理 | `room.getMyMembership()` | ✅ | ✅ |
| 集成管理 | Widget API | ✅ | ❌ |

#### 3.2.6 帮助关于页

| 功能 | 实现方式 | 桌面端 | 移动端 |
|------|---------|--------|--------|
| 版本信息 | package.json + SDK | ✅ | ✅ |
| 检查更新 | Tauri API / HTTP | ✅ | ❌ |
| 问题反馈 | 外部链接/表单 | ✅ | ✅ |
| 隐私政策 | 外部链接 | ✅ | ✅ |

## 4. 技术架构

### 4.1 组件结构

```
src/
├── components/
│   └── userMenu/
│       ├── index.vue                  # 入口组件（平台分发）
│       ├── UserMenuDesktop.vue        # 桌面端菜单
│       ├── UserMenuMobile.vue         # 移动端菜单
│       ├── UserMenuDropdown.vue       # 下拉菜单（桌面端）
│       ├── UserMenuSheet.vue          # 动作面板（移动端）
│       ├── UserMenuHeader.vue         # 菜单头部（共享）
│       ├── ThemeSwitchButton.vue      # 主题切换按钮
│       └── menuConfig.ts              # 菜单配置
├── views/
│   └── settingsWindow/
│       ├── index.vue                  # 入口组件（平台分发）
│       ├── SettingsDialog.vue         # 设置对话框（桌面端）
│       ├── SettingsSheet.vue          # 设置面板（移动端）
│       ├── SettingsTab.vue            # 设置标签页基类
│       ├── tabs/
│       │   ├── AccountSettings.vue    # 账户设置
│       │   ├── SessionSettings.vue    # 会话管理
│       │   ├── AppearanceSettings.vue # 外观设置
│       │   ├── NotificationSettings.vue # 通知设置
│       │   ├── PreferencesSettings.vue # 偏好设置
│       │   ├── KeyboardSettings.vue   # 快捷键设置（仅桌面）
│       │   ├── SecuritySettings.vue   # 安全隐私
│       │   ├── EncryptionSettings.vue # 加密设置
│       │   └── HelpSettings.vue       # 帮助关于
│       └── SettingsTabNav.vue         # 标签页导航
├── stores/
│   ├── userMenu.ts                    # 用户菜单状态
│   └── settingsDialog.ts              # 设置对话框状态
├── composables/
│   ├── useUserMenu.ts                 # 用户菜单 Hook
│   ├── useSettings.ts                 # 设置功能 Hook
│   └── usePlatform.ts                 # 平台检测 Hook
└── services/
    └── matrix/
        └── MatrixAccountService.ts    # 账户相关 SDK 封装
```

### 4.2 状态管理

```typescript
// stores/userMenu.ts
interface UserMenuState {
  isOpen: boolean
  position: { x: number; y: number } | null
  trigger: 'left' | 'right' | 'touch'
}

// stores/settingsDialog.ts
interface SettingsDialogState {
  isOpen: boolean
  activeTab: SettingsTabType
  initialData?: Record<string, any>
}

type SettingsTabType = 
  | 'account'
  | 'sessions'
  | 'appearance'
  | 'notifications'
  | 'preferences'
  | 'keyboard'  // 仅桌面端
  | 'security'
  | 'encryption'
  | 'help'
```

### 4.3 SDK 封装规范

```typescript
// services/matrix/MatrixAccountService.ts
import matrixClientService from './MatrixClientService'

class MatrixAccountService {
  // ✅ 使用 SDK API
  async updateDisplayName(name: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('客户端未初始化')
    await client.setDisplayName(name)
  }

  async updateAvatar(avatarUrl: string): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('客户端未初始化')
    await client.setAvatarUrl(avatarUrl)
  }

  async getDevices(): Promise<IDevice[]> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('客户端未初始化')
    const { devices } = await client.getDevices()
    return devices
  }

  async deleteDevice(deviceId: string, auth?: IAuthData): Promise<void> {
    const client = matrixClientService.getClient()
    if (!client) throw new Error('客户端未初始化')
    await client.deleteDevice(deviceId, auth)
  }

  // ❌ 禁止自行实现
  // async createRoom() { ... } // 应使用 MatrixRoomService
}

export const matrixAccountService = new MatrixAccountService()
```

### 4.4 平台适配实现

```typescript
// composables/usePlatform.ts
import { computed } from 'vue'

export function usePlatform() {
  const isDesktop = computed(() => typeof window !== 'undefined' && !!(window as any).__TAURI__)
  const isMobile = computed(() => {
    if (typeof window === 'undefined') return false
    return !isDesktop.value && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
  })
  
  return {
    isDesktop,
    isMobile,
    platform: isDesktop.value ? 'desktop' : 'mobile'
  }
}
```

```vue
<!-- components/userMenu/index.vue -->
<template>
  <UserMenuDesktop v-if="isDesktop" v-bind="$attrs" />
  <UserMenuMobile v-else v-bind="$attrs" />
</template>

<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { usePlatform } from '@/composables/usePlatform'

const { isDesktop } = usePlatform()

const UserMenuDesktop = defineAsyncComponent(() => import('./UserMenuDesktop.vue'))
const UserMenuMobile = defineAsyncComponent(() => import('./UserMenuMobile.vue'))
</script>
```

## 5. UI 设计规范

### 5.1 桌面端菜单样式
- 宽度：240px
- 圆角：8px
- 阴影：0 4px 12px rgba(0, 0, 0, 0.15)
- 背景：跟随主题（亮色 #fff / 暗色 #1a1a1a）

### 5.2 移动端菜单样式
- 宽度：100%
- 圆角：顶部 16px
- 最大高度：70vh
- 背景：跟随主题

### 5.3 设置对话框样式
- 桌面端宽度：720px（响应式）
- 桌面端最大高度：80vh
- 移动端：全屏展示
- 标签页宽度：200px（桌面端）/ 底部标签（移动端）

## 6. 阶段完成审查机制

### 6.1 审查流程

每个开发阶段完成后，执行以下审查流程：

```
阶段开发完成
    ↓
运行类型检查 (npx vue-tsc --noEmit)
    ↓
运行单元测试 (npx vitest run)
    ↓
启用 code-review 技能审查
    ↓
修复审查发现的问题
    ↓
更新任务状态
    ↓
进入下一阶段
```

### 6.2 审查清单

- [ ] 无 TypeScript 类型错误
- [ ] 无 ESLint 警告
- [ ] 单元测试通过
- [ ] SDK 功能正确使用（禁止重复开发）
- [ ] 多端适配正确
- [ ] 无安全漏洞
- [ ] 性能指标达标

## 7. 国际化支持

### 7.1 新增翻译键
```json
{
  "user_menu": {
    "settings": "设置",
    "notifications": "通知",
    "security": "安全隐私",
    "link_new_device": "链接新设备",
    "sign_out": "退出登录",
    "switch_theme_light": "切换到亮色主题",
    "switch_theme_dark": "切换到暗色主题"
  },
  "settings": {
    "account": { "title": "账户" },
    "sessions": { "title": "会话管理" },
    "appearance": { "title": "外观" },
    "notifications": { "title": "通知" },
    "preferences": { "title": "偏好设置" },
    "keyboard": { "title": "键盘快捷键" },
    "security": { "title": "安全隐私" },
    "encryption": { "title": "加密" },
    "help": { "title": "帮助关于" }
  }
}
```

## 8. 开发优先级

### P0 - 核心功能（必须实现）
1. 用户菜单下拉框（桌面端/移动端）
2. 设置对话框框架（桌面端/移动端）
3. 账户设置页
4. 外观设置页
5. 通知设置页

### P1 - 重要功能
1. 会话管理页
2. 安全隐私页
3. 帮助关于页

### P2 - 增强功能
1. 偏好设置页
2. 键盘快捷键页（仅桌面端）
3. 加密设置页
4. 主题快速切换

## 9. 测试要点

### 9.1 功能测试
- [ ] 左键点击头像弹出菜单（桌面端）
- [ ] 右键点击头像弹出菜单（桌面端）
- [ ] 点击头像弹出动作面板（移动端）
- [ ] 菜单项点击正确跳转
- [ ] 设置对话框标签页切换
- [ ] 主题切换功能
- [ ] 退出登录流程

### 9.2 多端测试
- [ ] 桌面端 Windows 正常
- [ ] 桌面端 macOS 正常
- [ ] 移动端 iOS 正常
- [ ] 移动端 Android 正常

### 9.3 性能测试
- [ ] 菜单打开速度 < 100ms
- [ ] 设置对话框打开速度 < 200ms
- [ ] 标签页切换流畅

## 10. 风险评估

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| Matrix SDK 功能限制 | 部分设置项无法实现 | 使用 SDK 提供的 API，降级显示 |
| 多端适配复杂 | 开发周期延长 | 优先桌面端，移动端简化 |
| 二维码登录实现复杂 | 功能延迟 | 依赖 MSC4108 支持，可选实现 |

## 11. 交付物

1. 用户菜单组件代码（桌面端/移动端）
2. 设置对话框组件代码（桌面端/移动端）
3. 各设置标签页组件代码
4. 相关状态管理代码
5. SDK 封装服务代码
6. 国际化翻译文件
7. 单元测试代码
8. 组件文档
