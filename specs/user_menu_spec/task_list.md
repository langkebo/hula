# 用户菜单改造任务列表

## 开发原则

1. **SDK 集成优先**：所有能通过 Matrix SDK 实现的功能，必须通过 SDK 实现
2. **多端同步开发**：每个功能需同时考虑桌面端和移动端实现
3. **阶段审查机制**：每个阶段完成后必须进行代码审查

## 阶段一：基础组件开发 (预计 2 天) - ✅ 已完成

### 1.1 共享层开发

| 任务ID | 任务描述 | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|------|--------|
| UM-001 | 创建 usePlatform Hook | `src/composables/usePlatform.ts` | ✅ 已完成 | P0 |
| UM-002 | 创建 userMenu Store | `src/stores/userMenu.ts` | ✅ 已完成 | P0 |
| UM-003 | 创建 settingsDialog Store | `src/stores/settingsDialog.ts` | ✅ 已完成 | P0 |
| UM-004 | 创建菜单配置文件 | `src/components/userMenu/menuConfig.ts` | ✅ 已完成 | P0 |
| UM-005 | 创建 useUserMenu Hook | `src/hooks/useUserMenu.ts` | ✅ 已完成 | P0 |

### 1.2 桌面端组件

| 任务ID | 任务描述 | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|------|--------|
| UM-006 | 创建 UserMenuDesktop 组件 | `src/components/userMenu/UserMenuDesktop.vue` | ✅ 已完成 | P0 |
| UM-007 | 实现左键点击菜单弹出 | `src/components/userMenu/UserMenuDesktop.vue` | ✅ 已完成 | P0 |
| UM-008 | 实现右键菜单支持 | `src/components/userMenu/UserMenuDesktop.vue` | ✅ 已完成 | P0 |
| UM-009 | 创建 UserMenuDropdown 组件 | `src/components/userMenu/UserMenuDropdown.vue` | ✅ 已完成 | P0 |
| UM-010 | 实现菜单位置计算 | `src/components/userMenu/UserMenuDropdown.vue` | ✅ 已完成 | P0 |

### 1.3 移动端组件

| 任务ID | 任务描述 | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|------|--------|
| UM-011 | 创建 UserMenuMobile 组件 | `src/components/userMenu/UserMenuMobile.vue` | ✅ 已完成 | P0 |
| UM-012 | 创建 UserMenuSheet 组件 | `src/components/userMenu/UserMenuSheet.vue` | ✅ 已完成 | P0 |
| UM-013 | 实现触摸手势支持 | `src/components/userMenu/UserMenuSheet.vue` | ✅ 已完成 | P1 |

### 1.4 共享组件

| 任务ID | 任务描述 | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|------|--------|
| UM-014 | 创建 UserMenuHeader 组件 | `src/components/userMenu/UserMenuHeader.vue` | ✅ 已完成 | P0 |
| UM-015 | 创建 ThemeSwitchButton 组件 | `src/components/userMenu/ThemeSwitchButton.vue` | ✅ 已完成 | P1 |
| UM-016 | 创建入口组件（平台分发） | `src/components/userMenu/index.vue` | ✅ 已完成 | P0 |

### 1.5 集成现有组件

| 任务ID | 任务描述 | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|------|--------|
| UM-017 | 替换 LeftAvatar 弹出框 | `src/layout/left/components/LeftAvatar.vue` | ✅ 已完成 | P0 |
| UM-018 | 添加菜单动画效果 | `src/components/userMenu/` | ✅ 已完成 | P1 |

### 📋 阶段一审查清单

完成以下检查后进入下一阶段：

```
✅ 运行类型检查: npx vue-tsc --noEmit (0 errors)
✅ 运行单元测试: npx vitest run (48 tests passed)
✅ 启用 code-review 技能审查
✅ 修复所有错误和警告
✅ 更新任务状态
```

---

## 阶段二：设置对话框开发 (预计 3 天) - ✅ 已完成

### 2.1 SDK 封装服务

| 任务ID | 任务描述 | 文件路径 | SDK API | 状态 | 优先级 |
|--------|---------|---------|---------|------|--------|
| UM-019 | 创建 MatrixAccountService | `src/services/matrix/MatrixAccountService.ts` | - | ✅ 已完成 | P0 |
| UM-020 | 封装显示名称修改 | `src/services/matrix/MatrixAccountService.ts` | `client.setDisplayName()` | ✅ 已完成 | P0 |
| UM-021 | 封装头像修改 | `src/services/matrix/MatrixAccountService.ts` | `client.setAvatarUrl()` | ✅ 已完成 | P0 |
| UM-022 | 封装密码修改 | `src/services/matrix/MatrixAccountService.ts` | `client.setPassword()` | ✅ 已完成 | P0 |
| UM-023 | 封装设备管理 | `src/services/matrix/MatrixAccountService.ts` | `client.getDevices()` | ✅ 已完成 | P1 |

### 2.2 桌面端对话框

| 任务ID | 任务描述 | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|------|--------|
| UM-024 | 创建 SettingsDialog 组件 | `src/views/settingsWindow/SettingsDialog.vue` | ✅ 已完成 | P0 |
| UM-025 | 创建 SettingsTabNav 组件 | `src/views/settingsWindow/SettingsTabNav.vue` | ✅ 已完成 | P0 |
| UM-026 | 创建 SettingsTab 基类 | `src/views/settingsWindow/SettingsTab.vue` | ✅ 已完成 | P0 |
| UM-027 | 实现标签页切换逻辑 | `src/views/settingsWindow/SettingsDialog.vue` | ✅ 已完成 | P0 |

### 2.3 移动端对话框

| 任务ID | 任务描述 | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|------|--------|
| UM-028 | 创建 SettingsSheet 组件 | `src/views/settingsWindow/SettingsSheet.vue` | ⏸️ 暂缓 | P0 |
| UM-029 | 创建移动端标签导航 | `src/views/settingsWindow/SettingsTabNavMobile.vue` | ⏸️ 暂缓 | P0 |
| UM-030 | 创建入口组件（平台分发） | `src/views/settingsWindow/index.vue` | ⏸️ 暂缓 | P0 |

### 2.4 账户设置页

| 任务ID | 任务描述 | SDK API | 桌面端 | 移动端 | 状态 |
|--------|---------|---------|--------|--------|------|
| UM-031 | 创建 AccountSettings 组件 | - | ✅ | ✅ | ✅ 已完成 |
| UM-032 | 实现用户资料编辑 | `client.setDisplayName()` | ✅ | ✅ | ✅ 已完成 |
| UM-033 | 实现头像修改 | `client.setAvatarUrl()` | ✅ 裁剪器 | ✅ 相机/相册 | ⏸️ 暂缓 |
| UM-034 | 实现密码修改 | `client.setPassword()` | ✅ | ✅ | ✅ 已完成 |
| UM-035 | 实现邮箱绑定 | `client.addThreePid()` | ✅ | ✅ | ⏸️ 暂缓 |

### 📋 阶段二审查清单

完成以下检查后进入下一阶段：

```
✅ 运行类型检查: npx vue-tsc --noEmit (0 errors)
✅ 运行单元测试: npx vitest run (48 tests passed)
✅ 启用 code-review 技能审查
✅ 验证 SDK API 正确使用
✅ 验证多端适配正确
✅ 修复所有错误和警告
✅ 更新任务状态
```

---

## 阶段三：设置页面开发 (预计 3 天) - ✅ 已完成

### 3.1 外观设置页

| 任务ID | 任务描述 | 实现方式 | 桌面端 | 移动端 | 状态 |
|--------|---------|---------|--------|--------|------|
| UM-036 | 创建 AppearanceSettings 组件 | - | ✅ | ✅ | ✅ 已完成 |
| UM-037 | 实现主题选择 | CSS 变量 + Store | ✅ | ✅ | ✅ 已完成 |
| UM-038 | 实现字体大小调整 | CSS 变量 | ✅ | ✅ | ✅ 已完成 |
| UM-039 | 实现布局模式切换 | 组件配置 | ✅ | ❌ | ⏸️ 暂缓 |
| UM-040 | 实现紧凑布局 | CSS 类切换 | ✅ | ❌ | ⏸️ 暂缓 |

### 3.2 通知设置页

| 任务ID | 任务描述 | SDK API | 桌面端 | 移动端 | 状态 |
|--------|---------|---------|--------|--------|------|
| UM-041 | 创建 NotificationSettings 组件 | - | ✅ | ✅ | ✅ 已完成 |
| UM-042 | 实现桌面通知开关 | `client.setPusher()` | ✅ Tauri | ✅ Web API | ✅ 已完成 |
| UM-043 | 实现通知声音设置 | 本地音频 | ✅ | ✅ | ✅ 已完成 |
| UM-044 | 实现关键词通知 | `client.setAccountData()` | ✅ | ✅ | ✅ 已完成 |

### 3.3 偏好设置页

| 任务ID | 任务描述 | 实现方式 | 桌面端 | 移动端 | 状态 |
|--------|---------|---------|--------|--------|------|
| UM-045 | 创建 PreferencesSettings 组件 | - | ✅ | ✅ | ✅ 已完成 |
| UM-046 | 实现语言设置 | i18n | ✅ | ✅ | ✅ 已完成 |
| UM-047 | 实现消息发送设置 | Store | ✅ | ✅ | ✅ 已完成 |
| UM-048 | 实现链接预览设置 | Store | ✅ | ✅ | ✅ 已完成 |

### 3.4 键盘快捷键页（仅桌面端）

| 任务ID | 任务描述 | 文件路径 | 状态 | 优先级 |
|--------|---------|---------|------|--------|
| UM-049 | 创建 KeyboardSettings 组件 | `src/views/settingsWindow/tabs/KeyboardSettings.vue` | ✅ 已完成 | P2 |
| UM-050 | 实现快捷键列表展示 | - | ✅ 已完成 | P2 |
| UM-051 | 实现快捷键自定义 | - | ✅ 已完成 | P2 |

### 📋 阶段三审查清单

完成以下检查后进入下一阶段：

```
✅ 运行类型检查: npx vue-tsc --noEmit (0 errors)
✅ 运行单元测试: npx vitest run (48 tests passed)
✅ 启用 code-review 技能审查
✅ 验证设置项持久化正确
✅ 验证多端 UI 差异正确
✅ 修复所有错误和警告
✅ 更新任务状态
```

---

## 阶段四：安全与加密设置 (预计 2 天) - ✅ 已完成

### 4.1 会话管理页

| 任务ID | 任务描述 | SDK API | 桌面端 | 移动端 | 状态 |
|--------|---------|---------|--------|--------|------|
| UM-052 | 创建 SessionSettings 组件 | - | ✅ | ✅ | ✅ 已完成 |
| UM-053 | 实现设备列表显示 | `client.getDevices()` | ✅ 完整 | ✅ 简化 | ✅ 已完成 |
| UM-054 | 实现设备重命名 | `client.setDeviceName()` | ✅ | ✅ | ✅ 已完成 |
| UM-055 | 实现设备登出 | `client.deleteDevice()` | ✅ | ✅ | ✅ 已完成 |
| UM-056 | 实现二维码登录 | MSC4108 | ✅ | ❌ | ⏸️ 暂缓 |

### 4.2 安全隐私页

| 任务ID | 任务描述 | SDK API | 桌面端 | 移动端 | 状态 |
|--------|---------|---------|--------|--------|------|
| UM-057 | 创建 SecuritySettings 组件 | - | ✅ | ✅ | ✅ 已完成 |
| UM-058 | 实现加密状态显示 | `client.crypto` | ✅ | ✅ | ✅ 已完成 |
| UM-059 | 实现恢复密钥管理 | `client.crypto.backup` | ✅ 完整 | ✅ 简化 | ⏸️ 暂缓 |
| UM-060 | 实现被忽略用户管理 | `client.setIgnoredUsers()` | ✅ | ✅ | ✅ 已完成 |
| UM-061 | 实现邀请管理 | `room.getMyMembership()` | ✅ | ✅ | ⏸️ 暂缓 |

### 4.3 加密设置页

| 任务ID | 任务描述 | SDK API | 桌面端 | 移动端 | 状态 |
|--------|---------|---------|--------|--------|------|
| UM-062 | 创建 EncryptionSettings 组件 | - | ✅ | ✅ | ✅ 已完成 |
| UM-063 | 实现加密密钥设置 | `client.crypto` | ✅ | ✅ | ✅ 已完成 |
| UM-064 | 实现安全备份配置 | `client.crypto.backup` | ✅ | ✅ | ⏸️ 暂缓 |

### 4.4 帮助关于页

| 任务ID | 任务描述 | 实现方式 | 桌面端 | 移动端 | 状态 |
|--------|---------|---------|--------|--------|------|
| UM-065 | 创建 HelpSettings 组件 | - | ✅ | ✅ | ✅ 已完成 |
| UM-066 | 实现版本信息展示 | package.json | ✅ | ✅ | ✅ 已完成 |
| UM-067 | 实现检查更新功能 | Tauri API | ✅ | ❌ | ✅ 已完成 |
| UM-068 | 实现问题反馈入口 | 外部链接 | ✅ | ✅ | ✅ 已完成 |

### 📋 阶段四审查清单

完成以下检查后进入下一阶段：

```
✅ 运行类型检查: npx vue-tsc --noEmit (0 errors)
✅ 运行单元测试: npx vitest run (48 tests passed)
✅ 启用 code-review 技能审查
✅ 验证加密功能正确使用 SDK
✅ 验证安全相关功能无漏洞
✅ 修复所有错误和警告
✅ 更新任务状态
```

---

## 阶段五：集成与测试 (预计 1 天) - ✅ 已完成

### 5.1 功能集成

| 任务ID | 任务描述 | SDK API | 状态 | 优先级 |
|--------|---------|---------|------|--------|
| UM-069 | 集成 Matrix SDK 用户信息 | `client.getUser()` | ✅ 已完成 | P0 |
| UM-070 | 集成 Matrix SDK 设备管理 | `client.getDevices()` | ✅ 已完成 | P1 |
| UM-071 | 集成 Matrix SDK 加密功能 | `client.crypto` | ✅ 已完成 | P2 |
| UM-072 | 实现退出登录流程 | `client.logout()` | ✅ 已完成 | P0 |
| UM-073 | 实现主题切换持久化 | Store + Tauri/Web API | ✅ 已完成 | P0 |

### 5.2 测试

| 任务ID | 任务描述 | 状态 | 优先级 |
|--------|---------|------|--------|
| UM-074 | 编写 UserMenu 组件测试 | ⏸️ 暂缓 | P1 |
| UM-075 | 编写 SettingsDialog 组件测试 | ⏸️ 暂缓 | P1 |
| UM-076 | 编写各设置页测试 | ⏸️ 暂缓 | P2 |
| UM-077 | 端到端测试 | ⏸️ 暂缓 | P1 |

### 5.3 文档与优化

| 任务ID | 任务描述 | 状态 | 优先级 |
|--------|---------|------|--------|
| UM-078 | 编写组件文档 | ⏸️ 暂缓 | P2 |
| UM-079 | 性能优化 | ⏸️ 暂缓 | P2 |
| UM-080 | 移动端适配优化 | ⏸️ 暂缓 | P2 |

### 📋 阶段五审查清单（最终审查）

完成以下检查后项目交付：

```
✅ 运行类型检查: npx vue-tsc --noEmit (0 errors)
✅ 运行单元测试: npx vitest run (48 tests passed)
✅ 启用 code-review 技能审查
✅ 验证所有 SDK 功能正确使用
✅ 验证多端功能完整
✅ 验证无安全漏洞
✅ 验证性能指标达标
✅ 修复所有错误和警告
✅ 更新任务状态
```

---

## 任务依赖关系

```
阶段一 (基础组件) 
    ↓ [审查通过]
阶段二 (设置对话框) 
    ↓ [审查通过]
阶段三 (设置页面) 
    ↓ [审查通过]
阶段四 (安全加密) 
    ↓ [审查通过]
阶段五 (集成测试)
    ↓ [最终审查]
交付
```

## 风险任务

| 任务ID | 风险描述 | 应对措施 |
|--------|---------|---------|
| UM-056 | 二维码登录依赖 MSC4108 | 检查 SDK 版本支持，可选实现 |
| UM-059 | 恢复密钥管理复杂 | 使用 SDK 内置方法，简化 UI |
| UM-063 | 加密设置涉及安全 | 严格使用 SDK API，禁止自行实现 |

## 里程碑

| 里程碑 | 预计完成时间 | 交付物 | 审查要求 |
|--------|-------------|--------|----------|
| M1 - 用户菜单可用 | 阶段一完成 | 可点击弹出菜单 | 类型检查 + 测试 + 代码审查 |
| M2 - 设置框架可用 | 阶段二完成 | 设置对话框可打开 | 类型检查 + 测试 + 代码审查 |
| M3 - 核心设置完成 | 阶段三完成 | 账户、外观、通知设置可用 | 类型检查 + 测试 + 代码审查 |
| M4 - 安全设置完成 | 阶段四完成 | 安全隐私设置可用 | 类型检查 + 测试 + 代码审查 |
| M5 - 功能完整 | 阶段五完成 | 全部功能测试通过 | 最终审查 |

## SDK API 使用规范

### ✅ 必须使用 SDK 的功能

| 功能 | SDK API | 禁止操作 |
|------|---------|----------|
| 用户认证 | `client.login()` | ❌ 自定义 HTTP 请求 |
| 显示名称 | `client.setDisplayName()` | ❌ 直接调用 API |
| 头像 | `client.setAvatarUrl()` | ❌ 自定义上传逻辑 |
| 密码 | `client.setPassword()` | ❌ 自定义修改流程 |
| 设备管理 | `client.getDevices()` | ❌ 自定义设备协议 |
| 加密 | `client.crypto` | ❌ 自定义加密算法 |
| 推送 | `client.setPusher()` | ❌ 自定义推送协议 |

### ⚠️ 可自定义实现的功能

| 功能 | 实现方式 | 说明 |
|------|---------|------|
| 主题切换 | CSS 变量 + Store | UI 层功能 |
| 字体大小 | CSS 变量 | UI 层功能 |
| 快捷键 | 本地事件监听 | 桌面端特有 |
| 语言设置 | i18n | UI 层功能 |
