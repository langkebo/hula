# HuLa 下一阶段前端优化与功能落地实施方案

> 生成日期：2026-04-25
> 基线依据：
> - 产品需求：`docs/settings_requirements.md`
> - 治理规划：`docs/FRONTEND_OPTIMIZATION_PLAN_2026-04-23.md`
> - 代码现状：截至 2026-04-25 仓库实查

---

## 1. 目标与决策原则

### 1.1 本阶段总目标

在不破坏现有主链路的前提下，完成设置体系与关联功能的“需求真值收口 + 交互闭环 + 测试闭环 + 性能闭环 + 交付闭环”，使设置模块从“多数页面可展示”升级为“全部页面可交互、可验证、可回归、可审计”。

### 1.2 统一决策原则

1. **产品真值以 `settings_requirements.md` 为准**  
   设置信息架构、字段、交互、安全确认、验收标准，以需求文档为唯一基线。

2. **工程治理以 `FRONTEND_OPTIMIZATION_PLAN_2026-04-23.md` 为准**  
   共享 composable、文件拆分、测试金字塔、CI 门禁、性能预算，以优化计划为实施方法。

3. **先收口信息架构，再补功能，再做质量门禁**  
   先删除或合并与需求不一致的重复实现，避免继续在错误结构上补功能。

4. **桌面端与移动端遵循“同源逻辑 + 分端视图”**  
   业务逻辑、状态模型、服务调用、校验规则统一沉到 composable / service 层；桌面与移动仅保留视图差异。

5. **所有设置项必须满足“可保存、可回读、可验证”**  
   禁止只改 `localStorage` 但不接入 Matrix/Tauri/后端服务；禁止仅展示 UI 无真实效果。

---

## 2. 当前实查结论

### 2.1 已有基础

- 设置页桌面端标签与基础组件已具备，主入口已可按标签异步加载。
- 部分页面已有页面级测试，通知、账户、会话、安全、加密、Labs、阅后即焚、屏蔽管理等已有基础回归网。
- 仓库已具备 `Vitest`、`Playwright`、`Storybook`、`web-vitals`、性能上报器等基础设施。
- 优化计划中的大文件治理、服务拆分、部分 composable 化已明显推进，可作为本轮继续复用的基础。

### 2.2 当前关键缺口

1. **设置信息架构未完全对齐需求文档**
   - 需求文档定义 15 个主标签；当前实现存在独立 `push`、`integrations` 标签，和需求文档主导航不一致。
   - `help-about` / `security-privacy` 等命名与实现侧仍存在口径差异。

2. **多处页面仍是“可展示但未闭环”**
   - 账户、外观、通知、帮助关于、集成等页面存在本地状态/demo 逻辑，未完整对接 Matrix/Tauri/后端能力。
   - 设置页总框架缺少需求文档要求的搜索、未保存变更提示、自动保存编排。

3. **测试体系尚未达到“组件级 + 页面级 + E2E”三层覆盖**
   - E2E 当前只有 3 条主链路，且 `core-flow.spec.ts` 仍是挂载 smoke 级别。
   - Storybook 构建已存在，但仓库内几乎没有 story 文件，无法支撑组件可视化审查。
   - 覆盖率虽有改善，但离“设置域三级覆盖率 >= 90%”仍有明显距离。

4. **CI 尚未形成强门禁**
   - 当前 workflow 有 typecheck、coverage、移动端 smoke、bundle 分析，但没有 Lighthouse 评分门禁、性能预算校验、Storybook 构建门禁、设置域 E2E 专项流水线。

5. **性能基础设施有观测，无预算闭环**
   - 已存在 `PerformanceReporter` / `WebVitalsObserver`，但未建立 PR 阶段预算判定与失败门禁。

---

## 3. 与需求不一致的实现收口策略

### 3.1 立即收口项

| 类型 | 当前实现 | 处理策略 | 目标状态 |
|---|---|---|---|
| 主导航重复 | `PushSettings.vue` 独立标签 | 合并入“通知设置”内的“推送与规则”分组，删除独立标签与重复路由 | 导航仅保留需求文档定义标签 |
| 主导航越界 | `IntegrationsSettings.vue` 独立标签 | 从设置主导航移出；若产品确认保留，先降级到 `Labs` 子页或“更多/扩展中心”，待需求文档补签后再恢复一级入口 | 设置主导航与需求文档一致 |
| 命名不一致 | `security` / `help` 等内部命名 | 统一为 `security-privacy` / `help-about`；保留 1 个兼容版本迭代周期的 alias，随后清理 | 路由、埋点、测试命名统一 |
| 双端重复实现 | desktop/mobile 各自维护本地状态 | 抽 `useXxxSettings()` 共享 composable，视图端仅保留渲染与平台差异 | “同源逻辑 + 分端视图” |

### 3.2 删除原则

- 删除所有仅用于过渡、与需求字段不一致、且已有共享实现可替代的旧组件/旧状态。
- 删除所有“假更新检测”“占位配置弹窗”“仅 `localStorage` 持久化但无服务回读”的伪实现。
- 删除前必须满足：
  - 新实现已具备等价或更完整能力；
  - 迁移脚本或兼容读取逻辑已提供；
  - 页面级与 E2E 用例已覆盖迁移后行为。

---

## 4. 模块实施清单

### 4.1 设置容器层

#### A. 设置框架重构

目标：
- 按需求文档补齐左侧 15 标签导航、顶部搜索、未保存变更提示条、危险变更离页确认。

实施项：
- 重构 `SettingsDialog` 容器，新增：
  - 全局搜索框；
  - `dirty state registry`；
  - 自动保存状态提示；
  - 离开标签页/关闭窗口的变更确认；
  - 桌面端宽度与响应式折叠规则。
- 重构标签定义 store：
  - 与需求文档 15 项完全对齐；
  - 移除独立 `push`、`integrations` 一级入口；
  - 统一内部枚举、路由、埋点 key。

产出：
- `useSettingsShell()` composable
- `settings-schema.ts`
- `settings-search-index.ts`
- 设置容器级测试 + 路由切换 E2E

### 4.2 账户设置

当前问题：
- 缺少 `about`、邮箱、电话、创建时间展示；
- 头像大小限制与需求不一致（当前 5MB，需求 10MB）；
- 注销流程缺少密码确认、协议勾选、二次确认；
- 无离页未保存提示。

实施项：
- 接入 `profile` / `3PID` / `account password` / `deactivate` 能力；
- 完整实现资料编辑、头像上传/删除、密码修改、账户注销流程；
- 增加危险操作红框、协议确认、密码校验、二次弹窗。

测试：
- 组件：表单校验、头像上传、危险操作确认；
- 页面：资料读写与回退；
- E2E：修改昵称、上传头像、密码修改失败/成功路径。

### 4.3 会话管理

当前问题：
- 已有基础设备列表，但缺少设备信任、交叉签名状态、批量操作体验收口。

实施项：
- 接入设备信任状态与验证流程；
- 增加“当前设备/其他设备/已验证设备”分组；
- 增加全选、批量登出、验证徽章、设备详情侧栏。

测试：
- 组件：设备项、批量操作栏；
- 页面：列表加载、重命名、批量删除；
- E2E：多设备登出链路。

### 4.4 外观设置

当前问题：
- 当前实现偏“字体/阴影/模糊/bubble style”，与需求文档定义的主题、主色、强调色、紧凑模式、时间戳、壁纸系统不一致。

实施项：
- 以需求文档重建外观域数据模型：
  - `theme`
  - `primary_color`
  - `accent_color`
  - `compact_mode`
  - `show_chat_timestamps`
  - `timestamp_format`
  - `always_show_timestamps`
  - `wallpaper`
  - `wallpaper_opacity`
- 提供实时预览区；
- 壁纸上传、内置壁纸选择、透明度滑块、主题即时切换；
- 清理旧的阴影/模糊/字体私有配置，除非产品补充签字保留。

测试：
- 组件：色板、壁纸卡片、透明度滑块；
- 页面：主题切换不闪烁、壁纸预览；
- E2E：主题/壁纸切换后的会话页效果验证。

### 4.5 通知设置

当前问题：
- 当前实现大量写入 `localStorage`，未完整接入 `pushers` / `pushrules`；
- “推送设置”被拆成独立标签，不符合需求文档导航结构。

实施项：
- 合并 `NotificationSettings` 与 `PushSettings`；
- 统一数据模型：
  - 通知渠道
  - 通知内容
  - 线程通知
  - 空间通知
  - 好友请求通知
  - 房间通知规则
  - 推送规则/设备推送器
- 接入 `MatrixPushService` 与推送规则管理；
- 提供房间级规则编辑抽屉。

测试：
- 组件：规则编辑器、关键词输入器、渠道切换器；
- 页面：全局规则与房间规则联动；
- E2E：关闭通知后无推送、关键词命中、房间规则覆盖全局规则。

### 4.6 偏好设置

实施项：
- 按文档补齐消息发送、阅后即焚默认、线程偏好、空间偏好、隐私偏好、媒体设置、语言与区域；
- 统一写入设置域 store，并映射到 Matrix account data / 本地配置；
- 与桌面/移动共用 `usePreferencesSettings()`。

### 4.7 键盘快捷键

当前问题：
- 当前仅覆盖少量快捷键，未形成完整映射、冲突检测和恢复默认策略。

实施项：
- 补齐需求文档快捷键清单；
- 增加录制态、冲突检测、保留键拦截、平台差异映射；
- 接入 Tauri 全局快捷键能力并提供权限/失败反馈。

测试：
- 组件：快捷键录制器；
- 页面：冲突提示、恢复默认；
- E2E：快捷键录制与生效验证。

### 4.8 侧边栏设置

实施项：
- 按文档补齐侧边栏显隐、分组、线程、好友分组、空间显示偏好；
- 对齐桌面端主界面左栏真实渲染行为；
- 移动端如无对应入口，仅保留共享配置模型与消费方。

### 4.9 语音视频设置

当前问题：
- 已有设备枚举、测试与预览，但需补齐需求中的设备配置与通话偏好完整闭环。

实施项：
- 增加设备断开回退、权限状态提示、测试失败恢复、视频预览超时、回声/噪声/增益配置落地；
- 与 WebRTC 主链路共享设备选择；
- 为设备能力建立服务层缓存与探测结果。

测试：
- 组件：设备选择器、预览面板、音量表；
- 页面：切换设备、权限拒绝、断开回退；
- E2E：摄像头预览 2s 内可见。

### 4.10 安全与隐私

实施项：
- 按文档补齐：
  - 在线状态/已读/输入中/资料可见性等隐私控制；
  - 忽略/屏蔽用户；
  - 邀请黑白名单；
  - 登录安全；
  - 完整账户注销流程。
- 与 Mjolnir 形成边界：
  - `Security & Privacy` 管个人级控制；
  - `Mjolnir` 管服务器/列表级屏蔽。

测试：
- 页面级场景必须覆盖在线状态开关、屏蔽后消息隔离、最近登录记录。

### 4.11 加密设置

实施项：
- 补齐加密状态、Secure Backup、Secret Storage、设备验证、交叉签名状态；
- 直接复用既有加密组件测试资产，补页面编排层。

### 4.12 Labs

实施项：
- 对照文档标记“已毕业/实验中/高风险”状态；
- 已毕业项从 Labs 退出，仅保留状态说明；
- 若 `Integrations` 本阶段保留，则先放入 Labs 的“扩展中心（Beta）”。

### 4.13 Mjolnir

实施项：
- 补齐屏蔽列表类型、规则管理、同步状态、导入导出；
- 增加空态、错误态、列表审计提示。

### 4.14 帮助与关于

当前问题：
- 当前更新检测为 `setTimeout` 模拟；
- 版本信息通过 `/package.json` 兜底读取，真实性不足；
- 缺少诊断信息与下载链路校验。

实施项：
- 接入真实版本源：Tauri app/version、Matrix SDK 版本、提交 SHA、构建时间；
- 实现真实更新检测、下载、失败提示、手动重试；
- 增加诊断面板：网络状态、同步状态、日志入口、故障导出。

测试：
- 组件：更新状态卡、诊断卡；
- 页面：检查更新成功/失败、日志目录打开；
- E2E：版本信息展示、外链打开、更新 API mock 响应。

### 4.15 好友管理

实施项：
- 以文档为准补齐好友请求设置、好友分组管理、好友备注与显示名；
- 与现有好友域 composable 对齐，形成桌/移同源。

### 4.16 阅后即焚

实施项：
- 复核“SDK+前端已实现”的真实达成度；
- 以设置页补齐全局默认、房间级策略、统计信息、风险警示；
- 与偏好设置的“默认值”联动。

---

## 5. 共享架构方案

### 5.1 目录策略

新增或重构以下共享层：

```text
src/composables/settings/
  useSettingsShell.ts
  useAccountSettings.ts
  useSessionSettings.ts
  useAppearanceSettings.ts
  useNotificationSettings.ts
  usePreferencesSettings.ts
  useKeyboardSettings.ts
  useSidebarSettings.ts
  useVoiceVideoSettings.ts
  useSecurityPrivacySettings.ts
  useEncryptionSettings.ts
  useLabsSettings.ts
  useMjolnirSettings.ts
  useHelpAboutSettings.ts
  useFriendsSettings.ts
  useBurnAfterReadSettings.ts

src/components/settings/
  shell/
  account/
  sessions/
  appearance/
  notifications/
  ...
```

### 5.2 状态与数据源分层

- **UI 临时态**：组件内 `ref/reactive`
- **页面编排态**：`useXxxSettings()`
- **跨页面共享态**：Pinia settings domain
- **服务层**：Matrix / Tauri / backend service
- **持久化优先级**：
  1. Matrix account data / profile / push rules / device / crypto
  2. Tauri 本地能力配置
  3. `localStorage` 仅用于短期缓存与兜底，不作为权威数据源

### 5.3 删除重复实现的技术路径

1. 先抽共享 composable；
2. 再让 desktop / mobile 改为消费者；
3. 加测试覆盖新编排；
4. 最后删除旧页面内联逻辑与重复状态；
5. 清理 dead code、旧 key、旧路由 alias。

---

## 6. 测试实施方案

## 6.1 覆盖目标

- 设置域组件级覆盖率：`>= 90%`
- 设置域页面级覆盖率：`>= 90%`
- 设置域关键 E2E 场景覆盖率：`>= 90%`
- 总体要求：关键分支必须覆盖 happy path + error path + permission denied path + rollback path

### 6.2 三层测试模型

#### 第一层：组件级

范围：
- 输入表单
- 色板/滑块/开关
- 设备选择器
- 规则编辑器
- 快捷键录制器
- 危险操作确认框
- 诊断卡片

工具：
- `Vitest` + `@vue/test-utils`
- `msw` / typed mocks

要求：
- 每个公共设置组件必须有 story + test 成对存在。

#### 第二层：页面级

范围：
- 每个设置标签页 1 个主测试文件；
- 覆盖数据加载、保存、失败回退、权限提示、空态/错误态/加载态。

要求：
- 每页至少覆盖：
  - 首次加载
  - 修改并保存
  - 保存失败
  - 离页确认

#### 第三层：E2E

新增 Playwright 套件：

- `e2e/settings-shell.spec.ts`
- `e2e/settings-account.spec.ts`
- `e2e/settings-notifications.spec.ts`
- `e2e/settings-appearance.spec.ts`
- `e2e/settings-security.spec.ts`
- `e2e/settings-encryption.spec.ts`
- `e2e/settings-friends.spec.ts`
- `e2e/settings-burn-after-read.spec.ts`
- `e2e/settings-help-about.spec.ts`

关键门禁场景：
- 搜索设置项可定位到对应标签
- 未保存变更切换标签触发提示
- 通知规则写入后可回读
- 危险操作需要二次确认
- 桌面/移动共享逻辑行为一致

### 6.3 Storybook 策略

本阶段必须补齐 `src/components/settings/**` stories：

- 每个核心设置组件提供：
  - Default
  - Loading
  - Error
  - Empty
  - Danger
  - Dark mode

Storybook 用途：
- Code Review 可视化对照
- 视觉回归基线
- 设计验收快照

---

## 7. 性能预算与审计方案

### 7.1 预算指标

| 指标 | 预算 |
|---|---|
| 首屏加载时间 | `<= 1.5s` |
| 关键交互响应时间 | `<= 100ms` |
| Lighthouse Performance | `>= 90` |
| Lighthouse Accessibility | `>= 90` |
| Lighthouse Best Practices | `>= 90` |
| 设置页切换渲染时间 | `<= 300ms` |
| 视频预览启动 | `<= 2s` |
| Long task | 单次 `< 50ms` |

### 7.2 技术实现

1. 复用现有 `WebVitalsObserver` 与 `PerformanceReporter`
2. 新增 `settings-performance-budget.json`
3. 新增脚本：
   - `pnpm perf:lighthouse`
   - `pnpm perf:budget`
   - `pnpm perf:settings`
4. 为设置容器和关键标签埋点：
   - shell 首次渲染
   - 标签切换渲染
   - 搜索响应
   - 壁纸/主题切换完成
   - 设备预览启动

### 7.3 性能优化手段

- 设置页子模块按标签异步加载；
- 搜索索引预构建、结果高亮延迟最小化；
- 大型列表虚拟化；
- 壁纸图像压缩与缓存；
- 颜色/主题切换避免整页重渲染；
- 设备枚举与诊断调用懒触发；
- 敏感服务调用防抖/去重。

---

## 8. CI / CD 门禁方案

### 8.1 必须新增的流水线

新增 `settings-quality.yml`，PR 必跑：

1. `pnpm check`
2. `pnpm vue-tsc --noEmit`
3. `pnpm test:run -- settings-related`
4. `pnpm coverage`
5. `pnpm test:e2e --grep @settings`
6. `pnpm build-storybook`
7. `pnpm perf:lighthouse`
8. `pnpm perf:budget`

### 8.2 失败即阻塞

以下任一失败，禁止合并：

- 覆盖率低于 90%
- Lighthouse 任一核心评分低于 90
- 性能预算超标
- Storybook 构建失败
- 设置域 E2E 失败
- `pnpm check` / `vue-tsc` 失败

### 8.3 产物归档

CI 每次 PR 自动上传：

- `coverage/`
- `playwright-report/`
- `storybook-static/`
- `lighthouse-report/`
- `bundle-metrics.json`
- `settings-audit-report.json`

---

## 9. 里程碑与排期

### Phase 0：真值收口（2-3 天）

目标：
- 对齐导航、路由、命名、数据模型；
- 输出删除清单与迁移图；
- 冻结旧实现新增开发。

完成标准：
- 主导航与需求文档一致；
- `push`、`integrations` 处理策略评审通过；
- 共享 settings schema 落地。

### Phase 1：容器与高优先级功能（5-7 天）

范围：
- 设置容器
- 账户
- 会话
- 通知（含推送）
- 安全隐私
- 帮助关于

原因：
- 这些模块用户可见度最高，且当前伪实现/风险最大。

### Phase 2：中优先级功能与共享化（5-7 天）

范围：
- 外观
- 偏好
- 键盘快捷键
- 侧边栏
- 语音视频
- 好友管理
- 阅后即焚

### Phase 3：加密、Labs、Mjolnir 与收尾（4-6 天）

范围：
- 加密编排层补齐
- Labs 毕业项清理
- Mjolnir 完整化
- 删除旧实现
- 文档与 Storybook 收口

### Phase 4：质量门禁与审计（3-4 天）

范围：
- 覆盖率冲刺到 90%+
- Lighthouse / budget 接入 CI
- 交付物打包与 Code Review checklist

---

## 10. 可交付清单

本阶段完成后必须产出：

1. **完整源码**
   - 设置域新组件、共享 composable、服务层适配、迁移脚本

2. **Storybook 组件库**
   - 设置域所有核心组件 stories

3. **测试报告**
   - 组件级 / 页面级 / E2E 覆盖率与结果

4. **性能审计报告**
   - Lighthouse 报告
   - Web Vitals / render samples
   - 性能预算校验结果

5. **部署与回滚文档**
   - 功能开关策略
   - 配置迁移说明
   - 回滚步骤

6. **删除与迁移清单**
   - 删除的旧实现文件
   - 替换关系
   - 兼容策略

---

## 11. 合并前验收标准

所有 PR 合并主干前必须满足：

- `pnpm check` 通过
- `pnpm vue-tsc --noEmit` 通过
- 设置域单测/页面测/端到端全部通过
- 覆盖率 `>= 90%`
- Lighthouse 三项核心评分 `>= 90`
- Storybook 构建通过
- 无与需求文档冲突的残留入口、重复组件、旧状态 key
- Code Review 完成并附：
  - 功能截图/录屏
  - Storybook 链接/产物
  - 覆盖率报告
  - Lighthouse 报告
  - 删除清单

---

## 12. 首批建议执行顺序

按 ROI 与风险排序，首批建议如下：

1. `SettingsShell + 导航真值收口`
2. `通知 + PushSettings 合并`
3. `帮助关于` 假实现替换为真实更新/诊断链路
4. `账户设置` 完整化
5. `安全隐私` 与 `Mjolnir` 边界收口
6. `外观设置` 按需求重建
7. `测试三层补齐 + Storybook 建库`
8. `Lighthouse + 性能预算` 接入 CI
9. 删除旧重复实现并完成回归

---

## 13. 风险与规避

| 风险 | 影响 | 规避策略 |
|---|---|---|
| 需求文档与现网行为不一致 | 重构返工 | Phase 0 先做产品/前端联合评审 |
| Matrix / Tauri 能力差异 | 部分功能桌面/移动不一致 | 统一 capability adapter，显式降级提示 |
| 旧状态迁移失败 | 用户配置丢失 | 提供兼容读取 + 一次性迁移脚本 |
| 测试成本过高拖慢交付 | 里程碑延期 | 先覆盖高风险路径，再补次要 UI 变体 |
| 性能预算过严导致频繁阻塞 | PR 阻塞 | 先记录基线 1 周，再正式 gate |

---

## 14. 最终结论

下一阶段不应继续在现有“部分设置页本地状态化、主导航口径分裂、测试/性能门禁未闭环”的结构上做增量堆砌；应以“**设置真值收口 -> 共享逻辑抽取 -> 高优先级功能闭环 -> 三层测试补齐 -> CI/性能 gate -> 删除旧实现**”为主线推进。

只有在上述 6 条主线全部收口后，设置域才能满足“可交互、可验证、可审计、可合并”的交付要求。
