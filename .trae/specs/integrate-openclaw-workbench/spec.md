# OpenClaw 工作台集成 Spec

## Why
当前 `hula` 已具备基础的 OpenClaw 服务接入代码，但桌面端主入口仍停留在旧 chatbot/robot 工作台形态，界面、交互与 OpenClaw 模块能力不一致，也缺少 OpenClaw 本地安装检测与安装引导。需要将现有 chatbot 入口升级为 OpenClaw 专属工作台，在延续 HuLa 视觉体系的前提下，完整接通 OpenClaw 的桌面使用闭环。

## What Changes
- 将当前 chatbot 对应的桌面端主入口重构为 OpenClaw 专属工作台 UI，参考 `openclaw-UI--Chinese` 的信息架构、聊天布局与视觉语义，并融合 HuLa 现有主题变量、组件体系和导航风格。
- 收敛当前分散的 `robot` 与轻量 `OpenClawView` 双入口，统一为一个面向 OpenClaw 的桌面体验主入口。
- 补齐 OpenClaw 工作台的关键交互逻辑，包括欢迎态、连接态、模型选择、会话发送、流式响应、失败重试、空配置提示与状态反馈。
- 新增桌面端 OpenClaw 模块安装检测能力，按 `windows` / `macos` / `linux` 输出对应的安装提示文案与后续操作建议。
- 新增“一键安装 OpenClaw”入口，打通前端按钮、桌面端命令、安装执行、进度/结果反馈链路。
- 对不支持一键安装或自动安装失败的场景，提供可见的降级方案，包括手动安装说明、外部链接或本地命令提示。
- **BREAKING**: 当前 chatbot/robot 桌面入口的默认 UI 与导航语义将切换为 OpenClaw 工作台，旧的 chatbot 外观与入口文案不再作为默认体验保留。

## Impact
- Affected specs: 桌面 AI 工作台、OpenClaw 本地连接、桌面端模块安装与环境检测、AI 会话交互反馈
- Affected code: `src/plugins/robot/**`、`src/views/openclaw/**`、`src/components/openclaw/**`、`src/layout/left/config.tsx`、`src/router/routes/desktop.ts`、`src/services/openclaw/**`、`src/services/ai-provider.ts`、`src/utils/PlatformConstants.ts`、`src/services/tauriCommand.ts`、`src-tauri/src/command/**`、`src-tauri/src/lib.rs`

## ADDED Requirements
### Requirement: OpenClaw 专属工作台界面
系统 SHALL 将当前 chatbot 对应的桌面端入口呈现为 OpenClaw 专属工作台，并在整体视觉上参考 `openclaw-UI--Chinese`，同时保持与 HuLa 的主题、字体、间距、暗色模式和桌面导航一致。

#### Scenario: 从左侧插件入口进入 OpenClaw 工作台
- **WHEN** 用户从当前 chatbot 对应入口进入 AI 工作台
- **THEN** 页面显示 OpenClaw 专属布局，而不是旧 chatbot/robot 默认布局
- **THEN** 页面包含 OpenClaw 品牌化的欢迎区、消息区、输入区、连接信息区和操作入口
- **THEN** 页面颜色、阴影、边框、圆角和暗色模式行为遵循 HuLa 现有设计体系

#### Scenario: 首次进入且没有消息
- **WHEN** 用户首次打开 OpenClaw 工作台且当前会话为空
- **THEN** 页面显示 OpenClaw 欢迎态、推荐操作或引导文案
- **THEN** 用户可以直接执行连接、安装、模型选择或开始提问

### Requirement: OpenClaw 会话交互完整性
系统 SHALL 在 OpenClaw 工作台中提供完整且连贯的会话交互体验，覆盖连接状态展示、模型选择、消息发送、流式输出、错误提示和重试反馈。

#### Scenario: OpenClaw 已可连接
- **WHEN** 本地 OpenClaw 服务可访问
- **THEN** 页面展示已连接状态和可用模型信息
- **THEN** 用户发送消息后应收到流式响应，并在响应结束后更新最终消息内容

#### Scenario: OpenClaw 连接失败
- **WHEN** 网关不可达、鉴权失败或流式请求异常
- **THEN** 页面显示明确的失败状态和原因
- **THEN** 用户可以执行重试、检查配置或安装 OpenClaw

#### Scenario: 工作台处于处理中
- **WHEN** 用户已发送消息且响应仍在生成
- **THEN** 输入区、停止/重试按钮、滚动行为和占位反馈应保持一致且可理解
- **THEN** 页面不出现旧 chatbot 视图与新 OpenClaw 视图并存的割裂状态

### Requirement: 桌面端 OpenClaw 安装状态检测
系统 SHALL 在桌面端检测当前系统是否已安装 OpenClaw 模块，并基于操作系统类型返回可供界面直接展示的状态结果。

#### Scenario: 已安装 OpenClaw
- **WHEN** 用户打开 OpenClaw 工作台或主动触发安装检测
- **THEN** 系统识别 OpenClaw 已安装
- **THEN** 界面显示“已安装”状态，并提供启动、连接或继续使用提示

#### Scenario: 未安装 OpenClaw
- **WHEN** 用户打开 OpenClaw 工作台或主动触发安装检测
- **THEN** 系统识别当前设备尚未安装 OpenClaw
- **THEN** 界面显示与当前桌面系统类型相匹配的安装提示信息
- **THEN** 提示信息至少包含平台名称、安装方式概览、失败时的手动安装建议

### Requirement: 一键安装 OpenClaw
系统 SHALL 在桌面端 OpenClaw 工作台中提供“一键安装 OpenClaw”操作，并通过前后端联动完成安装执行与结果反馈。

#### Scenario: 支持自动安装的平台
- **WHEN** 当前系统为 `windows`、`macos` 或 `linux`，且具备自动安装前置条件
- **THEN** 用户可点击“一键安装 OpenClaw”按钮启动安装流程
- **THEN** 页面展示安装中状态、关键进度反馈和最终结果
- **THEN** 安装成功后页面自动刷新安装状态，并引导用户连接或启动 OpenClaw

#### Scenario: 自动安装失败或不满足前置条件
- **WHEN** 安装命令执行失败、权限不足、网络异常或平台条件不满足
- **THEN** 页面显示失败原因或可理解的通用错误提示
- **THEN** 页面保留手动安装方案，不让用户停留在无反馈状态

### Requirement: 平台差异化安装提示
系统 SHALL 根据当前桌面操作系统类型生成差异化安装说明，避免向用户展示不适用的命令或路径。

#### Scenario: macOS 安装提示
- **WHEN** 当前系统为 `macos`
- **THEN** 界面展示适用于 macOS 的安装提示和后续启动建议

#### Scenario: Windows 安装提示
- **WHEN** 当前系统为 `windows`
- **THEN** 界面展示适用于 Windows 的安装提示和后续启动建议

#### Scenario: Linux 安装提示
- **WHEN** 当前系统为 `linux`
- **THEN** 界面展示适用于 Linux 的安装提示和后续启动建议

## MODIFIED Requirements
### Requirement: Chatbot 桌面入口
系统 SHALL 将当前左侧栏中 chatbot/robot 对应的桌面入口定义为 OpenClaw 工作台入口，统一其入口文案、路由语义、默认落地页和相关空态提示。

#### Scenario: 用户点击当前 chatbot 入口
- **WHEN** 用户点击左侧栏现有 chatbot/robot 入口
- **THEN** 系统进入 OpenClaw 工作台主页面
- **THEN** 用户不会进入旧 chatbot 专用界面或与 OpenClaw 平行存在的重复入口

### Requirement: OpenClaw 视图组织方式
系统 SHALL 统一桌面端 OpenClaw 相关页面与旧 robot 工作台的职责边界，避免存在两套能力不一致的 AI UI 实现。

#### Scenario: 打开旧 OpenClaw 轻量页
- **WHEN** 系统或用户访问现有 OpenClaw 轻量视图入口
- **THEN** 页面应复用统一后的 OpenClaw 工作台能力，或被安全重定向到统一入口

## REMOVED Requirements
### Requirement: 旧 chatbot 默认桌面外观
**Reason**: 旧 chatbot/robot 界面已无法准确表达 OpenClaw 模块的品牌、能力边界和安装引导流程，继续保留会造成入口语义和交互体验割裂。
**Migration**: 将旧 chatbot 入口的默认 UI、空态文案和交互重定向到统一的 OpenClaw 工作台；如需保留旧能力，需以内聚的 OpenClaw 子功能形式吸收，而非继续保留并行主界面。
