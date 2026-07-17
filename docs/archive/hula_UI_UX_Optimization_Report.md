# Hula 前端 UI/UX 全面审查与优化报告

## 一、 基准：后端 `synapse-rust` 能力体系梳理

为确保前端交互完整覆盖底层能力，我们首先对后端 `synapse-rust` 的业务边界与数据模型进行了剖析：

1. **核心通信协议**：基于 Matrix Client-Server API，涵盖了 Room (房间)、Space (群组/工作区)、Thread (消息回复链)、Direct Message (私聊)。
2. **端到端加密 (E2EE)**：支持 Olm/Megolm 会话，涉及设备密钥 (Device Keys)、交叉签名 (Cross-signing)、密钥备份 (Secure Backup) 与轮换。
3. **权限与审核**：包含细粒度的 Power Levels (权限等级控制)，Admin API 支持全域房间管理、成员封禁、设备注销。
4. **扩展能力支持**：支持 LiveKit (WebRTC) 语音/视频通话、媒体文件管理 (Quota 控制)、第三方 Push Gateway 接入，以及 OpenClaw (AI 大模型连接器)。

---

## 二、 前端 `hula` 全维度问题排查清单

基于后端能力模型，对前端各模块进行了系统性可用性 (Usability) 和无障碍 (Accessibility) 审查。

### 🔴 P0 - 核心可用性与布局断层 (Critical)
- [x] **中栏/右栏布局拥挤**：工具栏过多筛选项平铺，占据 200px 高度，挤压了会话列表空间；右栏高度硬编码导致滚动条断层。
- [x] **空状态 (Empty State) 粗糙**：大量使用了原生的 `n-empty` 或滑稽的“418”状态码、巨大的 Logo 图片，在“无聊天记录”、“无联系人”时体验极差，且缺乏下一步引导。
- [x] **错误反馈不闭环**：网络请求和加载过程未提供明确的 Loading 占位，请求失败后缺乏自动重试和 Toast 提示机制。

### 🟠 P1 - 视觉规范与设计一致性 (High)
- [x] **硬编码尺寸泛滥**：存在大量硬编码的 `12px`、`14px`，未接入响应式 `Typography`，在移动端和高分辨率屏下比例失调。
- [x] **颜色令牌未统一**：部分警示状态、背景色使用 `#ff4d4f` 等硬编码，未跟随系统的暗黑/明亮模式 `ThemeEnum` 切换。
- [x] **图标与间距不规范**：部分卡片和弹窗的内外边距未拉齐，按钮状态缺少明确的 Hover/Active 视觉反馈。

### 🟡 P2 - 交互效率与无障碍 (Medium)
- [x] **键盘导航与 A11y 缺失**：缺少对屏幕阅读器和全局快捷键 (Tab 键切换、Ctrl+F 搜索等) 的友好支持。
- [x] **次要信息过载**：右侧边栏功能单一且文字截断，未能有效利用空间展示群文件或置顶消息。

---

## 三、 已落地的 UI/UX 优化方案实施总结

### 1. 全局排版与响应式重构 (Typography & Responsive)
- **建立设计令牌**：在 `typography.scss` 和 `responsive.scss` 中定义了基于 `rem` 的字体阶层 (`text-xs` 到 `text-4xl`)。
- **消灭硬编码**：对 `ChatMain.vue`、`SettingsDialog.vue`、`LeftPanel`、`RoomSessionList.vue` 进行了地毯式清理，字体与间距全部替换为 CSS 变量。

### 2. 空间利用率与视觉减负 (Space Utilization)
- **工具栏折叠**：将 `RoomSpaceToolbar` 中臃肿的分类和状态过滤收纳入悬浮的 **Filter (漏斗) Popover** 和 **More (更多)** 菜单，彻底释放垂直空间。
- **右侧栏 Tab 化**：将原本拥挤的右侧栏改造为 `n-tabs` 选项卡，分为“成员”、“文件”、“置顶”，消除了文字截断，为后续接入后端对应的 API 提供空间。

### 3. 空状态与交互反馈重构 (Empty States & Feedback)
- **统一占位符风格**：全局注入 CSS，将 `n-empty` 的图标和文字颜色统一为 `text-quaternary` 与 `text-tertiary`，降低视觉噪声。
- **精准引导**：将主界面的巨大 Logo 替换为带有 SVG 图标与“选择一个会话或发起新聊天”操作引导的柔和空状态；会话列表移除了 418 错误码。
- **请求容错**：在 `MatrixHttpClient` 中全局引入 5xx 错误与网络异常的指数退避重试 (Retry) 机制，配合顶部 `$loadingBar` 提供稳定可靠的通信保障。

### 4. 无障碍 (A11y) 与兼容性 (Compatibility)
- **引入 GlobalAriaLive**：确保全局的通知与状态变更对屏幕阅读器可见。
- **深色模式同步**：重写了 `NaiveProvider` 的主题映射逻辑，确保 Naive UI 内部组件 (如 Input, Button, Tabs) 的颜色运算完美适配应用的 `--hula-*` CSS 变量体系。

---

## 四、 后续与演进建议

前端 `hula` 项目目前已具备非常扎实的现代前端基础。下一阶段建议聚焦于：
1. **深度对齐 E2EE 交互**：基于已有的 `MatrixHttpClient` 容错机制，进一步完善端到端加密中的设备验证 (Verification) 弹窗流程 UI。
2. **多媒体与大文件管理**：利用重构后的右侧栏“文件” Tab，接入后端的媒体 Quota 查询接口，实现可视化的群文件管理。
3. **深入 AI 集成**：将 OpenClaw 的生成过程与 UI 骨架屏深度绑定，提升“思考中”阶段的动画体验。
