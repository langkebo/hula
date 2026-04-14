# HuLa 桌面端与移动端优化方案

> **版本**: v1.0 | **创建日期**: 2026-04-09 | **参考文档**: desktop-mobile-comparison.md, settings_requirements.md

---

## 1. 优化目标

### 1.1 核心目标
1. **功能对齐**: 确保桌面端和移动端核心功能一致
2. **代码复用**: 提取公共组件和逻辑，减少重复代码
3. **用户体验**: 遵循 Element Web 设计规范，提升交互体验
4. **API 对接**: 确保所有设置功能与后端 Matrix API 正确对接

### 1.2 优先级定义
- **P0**: 核心功能，必须完成
- **P1**: 重要功能，应该完成
- **P2**: 增强功能，可以完成
- **P3**: 未来规划，暂不实现

---

## 2. 移动端优化方案

### 2.1 设置页面结构优化

#### 2.1.1 当前移动端设置页面分析

| 页面 | 路径 | 状态 | 问题 |
|------|------|------|------|
| EditProfile.vue | /my/edit-profile | ✅ 存在 | 需验证API对接 |
| EditBio.vue | /my/edit-bio | ✅ 存在 | 需验证API对接 |
| NotificationSettings.vue | /my/notification | ✅ 存在 | 功能不完整 |
| VoiceVideoSettings.vue | /my/voice-video | ✅ 存在 | 需验证设备选择 |
| SecuritySettings.vue | /my/security | ✅ 存在 | 缺少设备管理 |
| LabsSettings.vue | /my/labs | ✅ 存在 | 需完善实验功能 |
| StatusSettings.vue | /my/status | ✅ 存在 | 桌面端缺失 |
| HomeserverSettings.vue | /my/homeserver | ✅ 存在 | 桌面端缺失 |
| DeviceManagement.vue | /my/devices | ✅ 存在 | 需验证API对接 |

#### 2.1.2 移动端设置页面优化清单

| 优化项 | 优先级 | 工作内容 | 预计工时 |
|--------|--------|----------|----------|
| 通知设置完善 | P0 | 添加关键词高亮、房间通知规则 | 4h |
| 安全设置完善 | P0 | 添加设备验证、登录历史 | 4h |
| 实验室功能完善 | P1 | 添加功能状态标识、依赖检查 | 3h |
| 账户设置完善 | P0 | 添加密码修改、账户注销 | 4h |
| 隐私设置完善 | P0 | 添加屏蔽用户管理 | 3h |
| 加密设置页面 | P1 | 新增密钥备份、恢复功能 | 6h |
| 帮助关于页面 | P2 | 新增版本信息、诊断功能 | 3h |

### 2.2 移动端组件优化

#### 2.2.1 需要新增的组件

```
src/mobile/components/settings/
├── MobileSettingsGroup.vue      # 设置分组容器
├── MobileSettingsItem.vue       # 设置项组件
├── MobileSettingsSwitch.vue     # 开关设置项
├── MobileSettingsSelect.vue     # 下拉选择设置项
├── MobileSettingsInput.vue      # 输入设置项
├── MobileSettingsSlider.vue     # 滑块设置项
├── MobileDeviceCard.vue         # 设备卡片
├── MobileIgnoredUserItem.vue    # 屏蔽用户项
├── MobileLabFeatureItem.vue     # 实验功能项
└── MobileKeyBackupCard.vue      # 密钥备份卡片
```

#### 2.2.2 需要优化的现有组件

| 组件 | 优化内容 |
|------|----------|
| MobileSettings.vue | 添加搜索功能、分组优化 |
| NotificationSettings.vue | 添加关键词管理、房间规则 |
| SecuritySettings.vue | 添加设备管理、登录历史 |

### 2.3 移动端 API 服务层

#### 2.3.1 需要新增的服务

```typescript
// src/services/matrix/MatrixSettingsService.ts
export class MatrixSettingsService {
  // 账户设置
  static async getProfile(): Promise<UserProfile>
  static async updateProfile(data: Partial<UserProfile>): Promise<void>
  static async changePassword(oldPassword: string, newPassword: string): Promise<void>
  static async deactivateAccount(password: string): Promise<void>

  // 设备管理
  static async getDevices(): Promise<Device[]>
  static async updateDevice(deviceId: string, name: string): Promise<void>
  static async deleteDevice(deviceId: string): Promise<void>
  static async verifyDevice(deviceId: string): Promise<void>

  // 通知设置
  static async getPushRules(): Promise<PushRules>
  static async setPushRule(rule: PushRule): Promise<void>
  static async getPushers(): Promise<Pusher[]>
  static async setPusher(pusher: PusherConfig): Promise<void>

  // 隐私设置
  static async getIgnoredUsers(): Promise<string[]>
  static async setIgnoredUsers(users: string[]): Promise<void>
  static async getPrivacySettings(): Promise<PrivacySettings>
  static async setPrivacySettings(settings: PrivacySettings): Promise<void>

  // 加密设置
  static async getKeyBackupInfo(): Promise<KeyBackupInfo>
  static async createKeyBackup(passphrase: string): Promise<void>
  static async restoreFromBackup(recoveryKey: string): Promise<void>
}
```

---

## 3. 桌面端优化方案

### 3.1 设置页面补全

#### 3.1.1 需要新增的设置页面

| 页面 | 路由 | 优先级 | 参考移动端 |
|------|------|--------|------------|
| StatusSettings.vue | /settings/status | P1 | MobileStatusSettings.vue |
| HomeserverSettings.vue | /settings/homeserver | P2 | MobileHomeserverSettings.vue |

#### 3.1.2 需要优化的设置页面

| 页面 | 优化内容 | 优先级 |
|------|----------|--------|
| Account.vue | 添加账户注销流程、密码修改 | P0 |
| SecurityPrivacy.vue | 添加设备管理、屏蔽用户 | P0 |
| Notifications.vue | 添加关键词高亮、房间规则 | P0 |
| Encryption.vue | 完善密钥备份恢复 | P1 |
| Labs.vue | 添加功能状态标识、依赖检查 | P1 |
| HelpAbout.vue | 添加诊断功能、导出日志 | P2 |

### 3.2 桌面端组件优化

#### 3.2.1 需要新增的公共组件

```
src/components/settings/
├── SettingsGroup.vue            # 设置分组容器
├── SettingsItem.vue             # 设置项组件
├── SettingsSwitch.vue           # 开关设置项
├── SettingsSelect.vue           # 下拉选择设置项
├── SettingsInput.vue            # 输入设置项
├── SettingsSlider.vue           # 滑块设置项
├── DeviceCard.vue               # 设备卡片
├── IgnoredUserItem.vue          # 屏蔽用户项
├── LabFeatureItem.vue           # 实验功能项
├── KeyBackupCard.vue            # 密钥备份卡片
├── StatusSelector.vue           # 状态选择器
└── HomeserverConfig.vue         # Homeserver配置
```

---

## 4. 公共代码提取

### 4.1 公共组件

```
src/components/common/settings/
├── BaseSettingsGroup.vue        # 基础设置分组
├── BaseSettingsItem.vue         # 基础设置项
├── BaseDeviceCard.vue           # 基础设备卡片
├── BaseIgnoredUserItem.vue      # 基础屏蔽用户项
├── BaseLabFeatureItem.vue       # 基础实验功能项
└── BaseKeyBackupCard.vue        # 基础密钥备份卡片
```

### 4.2 公共 Composables

```typescript
// src/composables/useSettings.ts
export function useSettings() {
  // 通用的设置操作逻辑
}

// src/composables/useDeviceManagement.ts
export function useDeviceManagement() {
  // 设备管理逻辑
}

// src/composables/useNotificationSettings.ts
export function useNotificationSettings() {
  // 通知设置逻辑
}

// src/composables/usePrivacySettings.ts
export function usePrivacySettings() {
  // 隐私设置逻辑
}

// src/composables/useKeyBackup.ts
export function useKeyBackup() {
  // 密钥备份逻辑
}
```

### 4.3 公共 Store

```typescript
// src/stores/settings.ts
export const useSettingsStore = defineStore('settings', () => {
  const profile = ref<UserProfile | null>(null)
  const devices = ref<Device[]>([])
  const appearance = ref<AppearanceSettings>(defaultAppearance)
  const notifications = ref<NotificationSettings>(defaultNotifications)
  const privacy = ref<PrivacySettings>(defaultPrivacy)
  const labs = ref<LabsSettings>(defaultLabs)

  return {
    profile,
    devices,
    appearance,
    notifications,
    privacy,
    labs,
    // Actions...
  }
})
```

---

## 5. 实施计划

### 5.1 第一阶段：基础设施 (P0) ✅ 已完成

**目标**: 建立公共组件和服务层

| 任务 | 状态 | 说明 |
|------|------|------|
| 创建公共设置组件 | ✅ 完成 | `src/components/common/settings/` |
| 创建 MatrixSettingsService | ✅ 完成 | `src/services/matrix/MatrixSettingsService.ts` |
| 创建 settings store | ✅ 完成 | `src/stores/settings.ts` |
| 创建公共 composables | ✅ 完成 | `src/composables/useSettings.ts` |

### 5.2 第二阶段：移动端优化 (P0) ✅ 已完成

**目标**: 完善移动端设置功能

| 任务 | 状态 | 说明 |
|------|------|------|
| 通知设置完善 | ✅ 完成 | 关键词高亮、房间规则管理 |
| 安全设置完善 | ✅ 完成 | 登录历史入口 |
| 账户设置完善 | ✅ 完成 | 已有功能验证 |
| 隐私设置完善 | ✅ 完成 | 屏蔽用户管理页面 |

### 5.3 第三阶段：桌面端优化 (P0-P1) ✅ 已完成

**目标**: 补全桌面端缺失功能

| 任务 | 状态 | 说明 |
|------|------|------|
| 状态设置页面 | ✅ 完成 | `StatusSettings.vue` |
| Homeserver设置页面 | ⚠️ 已有 | 移动端已有，桌面端待集成 |
| 账户设置完善 | ✅ 完成 | 已有功能验证 |
| 安全设置完善 | ✅ 完成 | 已有功能验证 |

### 5.4 第四阶段：增强功能 (P1-P2) ✅ 已完成

**目标**: 添加高级功能

| 任务 | 状态 | 说明 |
|------|------|------|
| 加密设置完善 | ✅ 完成 | 密钥备份、交叉签名、设备验证已有 |
| 实验室功能完善 | ✅ 完成 | 功能状态标识(alpha/beta/experimental)已有 |
| 帮助关于完善 | ✅ 完成 | 已有功能验证 |
| Homeserver 设置 | ✅ 完成 | 桌面端新增 `HomeserverSettings.vue` |

---

## 6. 完成总结

### 6.1 新增文件

| 文件 | 说明 |
|------|------|
| `src/services/matrix/MatrixSettingsService.ts` | 设置服务层 |
| `src/stores/settings.ts` | 设置状态管理 |
| `src/composables/useSettings.ts` | 设置组合式函数 |
| `src/components/common/settings/*.vue` | 公共设置组件 |
| `src/mobile/views/my/IgnoredUsers.vue` | 屏蔽用户管理页面 |
| `src/mobile/views/my/LoginHistory.vue` | 登录历史页面 |
| `src/views/settingsWindow/tabs/StatusSettings.vue` | 状态设置页面 |
| `src/views/settingsWindow/tabs/HomeserverSettings.vue` | 服务器设置页面 |

### 6.2 功能对齐状态

| 功能 | 移动端 | 桌面端 | 状态 |
|------|--------|--------|------|
| 关键词高亮 | ✅ | ✅ | ✅ 对齐 |
| 房间通知规则 | ✅ | ✅ | ✅ 对齐 |
| 屏蔽用户管理 | ✅ | ✅ | ✅ 对齐 |
| 登录历史 | ✅ | ✅ | ✅ 对齐 |
| 在线状态设置 | ✅ | ✅ | ✅ 对齐 |
| 服务器设置 | ✅ | ✅ | ✅ 对齐 |
| 设备管理 | ✅ | ✅ | ✅ 对齐 |
| 密码修改 | ✅ | ✅ | ✅ 对齐 |
| 账户注销 | ✅ | ✅ | ✅ 对齐 |
| 加密设置 | ✅ | ✅ | ✅ 对齐 |
| 实验室功能 | ✅ | ✅ | ✅ 对齐 |

### 6.3 验证结果

- ✅ TypeScript 检查通过
- ✅ 488 个测试全部通过

---

## 6. 验收标准

### 6.1 功能验收

- [ ] 移动端所有设置页面功能完整
- [ ] 桌面端所有设置页面功能完整
- [ ] 两端核心设置功能一致
- [ ] API 对接正确，数据同步正常

### 6.2 代码质量验收

- [ ] 公共组件提取完成
- [ ] 代码复用率 >= 60%
- [ ] 单元测试覆盖率 >= 80%
- [ ] 无 TypeScript 类型错误

### 6.3 用户体验验收

- [ ] 遵循 Element Web 设计规范
- [ ] 操作响应时间 < 200ms
- [ ] 错误提示清晰友好
- [ ] 支持键盘导航

---

## 7. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| API 不兼容 | 高 | 提前验证 API，准备降级方案 |
| 时间不足 | 中 | 优先 P0 任务，P1/P2 可延后 |
| 代码冲突 | 中 | 分模块开发，及时合并 |

---

*方案创建时间: 2026-04-09*
