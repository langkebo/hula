# HuLa 类钉钉机器人系统技术方案

## 1. 文档信息

- 文档日期: 2026-05-19
- 适用范围: `HuLa` 前端工程、Tauri 容器层、Matrix 服务接入层
- 目标: 在现有 `robot` 与 `OpenClaw` 基础上，设计一个可扩展、可落地、支持房间内运行的类钉钉机器人系统
- 输出类型: 技术方案、实施路径、难点分析、成本评估、预期效果

## 2. 项目现状与设计前提

### 2.1 可直接复用的现有能力

结合当前仓库，以下能力已经具备，可作为机器人系统的一期基础：

1. `src/plugins/robot/` 已经存在 AI 机器人插件形态，说明前端已有独立机器人入口、对话消息渲染、模型与角色管理基础。
2. `src/views/openclaw/OpenClawView.vue` 与 `src/views/openclaw/composables/useOpenClawWorkbench.ts` 已经提供 OpenClaw 工作台、连接、模型选择、流式回复和会话管理。
3. `src/services/openclaw/OpenClawService.ts` 已经提供 OpenAI 兼容接口封装、SSE 流式输出、连接状态、自动重连、心跳与中断控制。
4. `src/services/secure/robotAiProviderStorage.ts` 已经实现 AI Provider 配置保存，并对 OpenClaw Token / TrendRadar API Key 进行了安全存储兜底。
5. `src/services/secure/secureStorage.ts` 已通过 Tauri Command 封装系统安全存储，适合继续承载用户 API Key、Bot Secret、会话 DEK 等敏感数据。
6. `src/services/matrix/messaging/MatrixMessageService.ts` 已具备文本、HTML、结构化消息、离线队列、编辑、已读、撤回等消息能力。
7. `src/services/matrix/messaging/MatrixReceiptService.ts` 已具备已读回执、未读统计、房间已读补发等实时能力。
8. `src/services/offline/OfflineQueueService.ts` 已具备离线重放、指数退避、失败状态持久化，可复用为机器人消息推送可靠性基础。
9. `src/components/common/PermissionGuard.vue` 与 `RoomCapabilitiesService.ts` 已具备前端权限门控与房间能力探测基础。

### 2.2 当前问题与缺口

尽管项目已有 `robot` 与 `OpenClaw` 基础，但距离“类钉钉机器人系统”仍有明显缺口：

1. 现有 `robot` 更像单体 AI 助手页，尚未形成“房间内机器人”的统一架构。
2. OpenClaw 工作台目前偏个人工作台模式，尚未与房间消息流、机器人身份、权限体系、消息推送中心打通。
3. 会话持久化当前主要依赖 `Pinia persist/localStorage`，适合普通设置，不适合隐私敏感的机器人对话内容。
4. API Key 虽有安全存储封装，但缺少“用户-Provider-模型-机器人实例”级别的完整认证与授权设计。
5. 房间机器人缺少虚拟存在、状态展示、并行调度、命令协议、插件生命周期管理。
6. 机器人消息尚未定义统一的消息协议，无法稳定支持文本、富文本、链接卡片、系统通知、可追踪回执等企业协同能力。
7. 现有能力未形成动态加载、异常隔离、熔断、降级、审计的完整机器人平台。

### 2.3 设计原则

本方案遵循以下原则：

1. 不绕开现有 Matrix 服务层，所有房间消息能力仍通过 `src/services/matrix/` 服务层封装。
2. 不将敏感数据保存在 `localStorage` 明文中，敏感配置走系统安全存储，非敏感元数据与索引走本地持久化。
3. 将“个人 AI 工作台”和“房间机器人”统一到同一机器人平台内，避免双轨维护。
4. 前端以插件化、可组合架构建设，优先实现房间场景的一期落地，再逐步增强为多机器人平台。
5. 充分利用项目已有 Web Worker、离线队列、权限守卫、Matrix 回执与撤回能力。

## 3. 总体目标

本次优化目标可拆分为五条主线：

1. 建设统一的机器人平台层，整合当前 `plugins/robot` 与 `views/openclaw`。
2. 建设房间内机器人能力，让机器人能“进房间、可见、可发消息、可追踪、可管理”。
3. 建设每用户独立 OpenClaw 能力，支持自有模型、自有 API Key、自有历史记录。
4. 建设可扩展消息协议与推送链路，支持富文本、链接卡片、权限控制、回执与撤回。
5. 建设性能、安全、隐私与运维可观测能力，保证企业级稳定性。

## 4. 总体架构设计

### 4.1 架构分层

建议将机器人系统拆分为五层：

1. 展示层
   - 房间内机器人入口
   - OpenClaw 工作台
   - 机器人卡片消息渲染器
   - 机器人状态面板与权限管理页
2. 状态层
   - 机器人中心 Store
   - 房间机器人运行时 Store
   - 用户 Provider 凭证 Store
   - 对话历史索引 Store
3. 领域层
   - Robot Runtime Service
   - Robot Dispatch Service
   - Robot Permission Service
   - Robot Presence Service
   - Robot Conversation Service
4. 基础设施层
   - Matrix Message / Receipt / Presence / Room Capability 服务
   - OpenClaw / TrendRadar / HuLa AI Provider 适配层
   - Secure Storage / Encrypted Local History / Offline Queue
   - Worker Registry / Plugin Loader
5. 协议层
   - 机器人消息协议
   - 房间机器人控制协议
   - Provider 凭证协议
   - 审计与异常事件协议

### 4.2 推荐目录结构

建议保留现有 `plugins/robot` 和 `views/openclaw`，但逐步将核心能力下沉到统一模块：

```text
src/
  modules/
    robot/
      components/
      composables/
      protocols/
      renderers/
      workers/
  services/
    robot/
      RobotRuntimeService.ts
      RobotDispatchService.ts
      RobotPresenceService.ts
      RobotPermissionService.ts
      RobotConversationService.ts
      RobotPluginRegistry.ts
      RobotAuditService.ts
      RobotCredentialService.ts
  stores/
    domains/
      robot/
        center.ts
        runtime.ts
        permission.ts
        conversation.ts
```

### 4.3 核心运行模型

机器人系统采用三种实体模型：

1. `RobotDefinition`
   - 定义机器人能力、图标、支持的 Provider、是否允许房间部署、支持的消息类型、权限要求。
2. `RobotInstance`
   - 某个房间内部署的一台机器人实例，主键建议为 `tenantId + roomId + botId`。
3. `RobotSession`
   - 用户与机器人之间的会话上下文，可分为个人会话与房间线程会话。

### 4.4 建议的数据主键

- 用户 Provider 配置主键: `userId + provider`
- 机器人实例主键: `roomId + botId`
- 房间线程会话主键: `roomId + threadId + botId`
- 个人工作台会话主键: `userId + botId + conversationId`
- 消息投递去重键: `roomId + botId + clientTxnId`

## 5. 机器人协议设计

### 5.1 消息类型协议

建议在 Matrix 标准消息上增加 `org.hula.bot` 扩展字段，遵循“标准字段可回退，自定义字段可增强”的原则。

统一消息结构建议如下：

```json
{
  "msgtype": "m.notice",
  "body": "机器人消息降级文本",
  "format": "org.matrix.custom.html",
  "formatted_body": "<p>机器人消息富文本</p>",
  "org.hula.bot": {
    "version": "1.0",
    "botId": "openclaw-assistant",
    "botName": "OpenClaw Assistant",
    "messageType": "text",
    "traceId": "trace_xxx",
    "deliveryMode": "room",
    "securityLevel": "private",
    "actions": []
  }
}
```

支持的 `messageType` 建议包括：

1. `text`
   - 纯文本或 Markdown 文本。
2. `rich_text`
   - 支持 HTML/Markdown 渲染，渲染前必须清洗。
3. `link_card`
   - 标题、描述、封面、链接、操作按钮。
4. `task_card`
   - 审批、提醒、待办型消息。
5. `system_notice`
   - 系统广播、告警、部署结果。
6. `stream_chunk`
   - 流式输出的中间态，仅前端本地消费，不直接持久化到房间。
7. `tool_result`
   - AI 工具调用结果，支持折叠展示。

### 5.2 房间机器人控制协议

建议定义以下房间级协议事件：

1. `org.hula.bot.registry`
   - 房间已部署机器人清单。
2. `org.hula.bot.presence`
   - 机器人在线状态、忙碌状态、最后活跃时间。
3. `org.hula.bot.command`
   - 用户对机器人发起的命令，如 `@bot 总结本周消息`。
4. `org.hula.bot.audit`
   - 机器人操作审计，如谁部署、谁修改、谁禁用。
5. `org.hula.bot.permission`
   - 房间内机器人可执行能力和角色范围。

### 5.3 交互协议建议

用户与机器人交互建议支持三种入口：

1. `@机器人名`
   - 适合普通对话、问答、总结。
2. `/bot <命令>`
   - 适合强结构命令，如部署、暂停、清空记忆、查看状态。
3. 机器人面板操作
   - 适合卡片表单、快捷动作、权限敏感操作。

### 5.4 系统事件总线

前端内部事件总线建议标准化为：

1. `robot:dispatch`
2. `robot:delivery:ack`
3. `robot:delivery:failed`
4. `robot:presence:changed`
5. `robot:conversation:updated`
6. `robot:permission:changed`
7. `robot:plugin:error`

## 6. 智能消息推送方案

### 6.1 推送链路设计

消息推送建议拆分为四段：

1. 触发阶段
   - 用户命令
   - 房间规则触发
   - 系统事件触发
   - 定时任务触发
2. 组装阶段
   - Robot Dispatch Service 根据 `messageType` 组装标准 Matrix 消息 + `org.hula.bot` 扩展字段
3. 投递阶段
   - 通过 `MatrixMessageService.sendTextMessage()`、`sendHtmlMessage()` 或 `sendStructuredMessage()` 发送
4. 跟踪阶段
   - 通过 `MatrixReceiptService` 追踪已读状态，通过 `MatrixMessageService.recallMessage()` 支持撤回

### 6.2 消息格式落地建议

1. 文本消息
   - 直接复用 `sendTextMessage`
2. 富文本消息
   - 复用 `sendHtmlMessage`
   - 必须统一接入 HTML 清洗
3. 链接卡片消息
   - 一期使用 `m.notice + formatted_body + org.hula.bot.card`
   - 二期抽象 `BotCardRendererRegistry`
4. 系统通知
   - 统一使用 `m.notice`
   - 默认不触发普通聊天未读高亮，可配置升级为高优先级

### 6.3 实时性设计

实时性依赖现有 Matrix Sliding Sync 与房间事件流，建议如下：

1. 房间消息投递继续走 Matrix 实时链路，避免自建 WebSocket 通道。
2. OpenClaw 流式回答在本地以 `stream_chunk` 累积，完成后再一次性写入房间，避免大量碎片事件污染房间时间线。
3. 对于“机器人正在思考”状态，使用本地状态 + `org.hula.bot.presence` 短状态事件显示，不直接发送多条房间消息。

### 6.4 可靠性设计

可靠性建立在现有 `OfflineQueueService` 基础上，增强如下：

1. 机器人消息全部带 `clientTxnId` 与 `traceId`，支持去重。
2. 推送失败统一进入离线重放队列，按房间和机器人维度串行重试。
3. 增加机器人消息失败状态 UI，允许用户“重新发送”或“撤销本次投递”。
4. 为房间机器人增加熔断器：
   - 同一机器人 1 分钟失败超过阈值，自动进入 `degraded` 状态。
5. 为富文本卡片渲染增加降级文本，防止其他客户端无法识别时消息不可读。

### 6.5 安全性设计

1. 推送消息前执行房间权限校验，禁止未授权机器人发起房间广播。
2. 敏感消息默认使用 `m.notice` 并打上 `securityLevel` 标签。
3. 对外链卡片增加白名单与 `openExternalUrl` 安全策略，不允许任意 schema。
4. 日志层统一脱敏，不记录完整 API Key、完整 Prompt、完整 Token。

### 6.6 已读追踪方案

建议利用现有 `MatrixReceiptService.getReadReceipts(roomId, eventId)` 实现：

1. 单消息已读人数展示
2. 房间机器人消息阅读面板
3. 管理员查看“重要通知未读人”
4. 支持阈值策略，如“超过 80% 已读视为送达成功”

### 6.7 撤回方案

撤回能力直接复用 `MatrixMessageService.recallMessage(roomId, eventId)`，并增加业务限制：

1. 仅允许机器人所有者、房间管理员、系统机器人撤回
2. 只允许撤回机器人自己发出的消息
3. 超时后只能“追加更正消息”，不能直接撤回
4. 撤回动作写入 `org.hula.bot.audit`

### 6.8 权限控制方案

建议权限分为三层：

1. 平台层
   - 是否开启机器人平台
   - 是否允许接入第三方 Provider
2. 房间层
   - 是否允许部署机器人
   - 是否允许机器人发卡片
   - 是否允许机器人读取房间上下文
3. 操作层
   - 谁能部署
   - 谁能配置 Provider
   - 谁能查看敏感对话
   - 谁能执行撤回、广播、摘要

## 7. OpenClaw 交互方案

### 7.1 建议的产品形态

OpenClaw 能力建议拆分为两种使用形态：

1. 个人工作台模式
   - 沿用 `OpenClawView`，面向个人长对话、探索、调试、草稿生成。
2. 房间机器人模式
   - 以“OpenClaw Assistant”机器人实例部署到房间，支持被 @、支持执行房间上下文总结、问答和任务卡片输出。

### 7.2 每用户独立模型与 API Key

当前 `robotAiProviderStorage.ts` 已支持保存 OpenClaw Token，但仍需升级为更完整的用户级凭证系统：

建议新增 `RobotCredentialService`，职责如下：

1. 以 `userId + provider` 维度存储凭证
2. 支持多套 Provider 凭证并存
3. 区分默认模型、默认温度、最大 token、连接策略
4. 将密钥明文仅保留在运行内存
5. 长期凭证只保存到系统安全存储

推荐配置结构：

```ts
interface UserProviderCredential {
  userId: string
  provider: 'openclaw' | 'hula' | 'trendradar'
  gatewayUrl: string
  defaultModel: string
  encryptedKeyRef: string
  scopes: string[]
  updatedAt: number
}
```

### 7.3 用户认证与 API Key 安全存储

基于当前项目现状，建议如下：

1. 桌面端优先使用 `secureStorage.ts` 对接系统 Keychain/Keystore。
2. 将当前 `sessionCrypto.ts` 仅作为浏览器/不支持安全存储时的短期会话兜底，不再作为长期持久化主方案。
3. 对话历史使用“数据加密密钥 DEK”进行应用层加密，DEK 本身保存在系统安全存储。
4. 用户切换账号时，按 `userId` 命名空间隔离所有 Provider 凭证。
5. 在 UI 层提供“测试连接”“展示最后四位”“一键删除凭证”。

### 7.4 对话历史方案

当前 OpenClaw 会话主要使用 `Pinia persist`，建议升级为“两层存储”：

1. 元数据层
   - 会话标题、更新时间、模型、房间归属、是否收藏
   - 可存 `IndexedDB` 或 Tauri SQLite
2. 内容层
   - Prompt、回复、推理内容、工具结果
   - 使用 DEK 加密后存储

建议：

1. 个人工作台会话默认私有，仅本人可见
2. 房间机器人会话分为
   - 房间公开会话
   - 房间私有线程会话
   - 管理员可审计会话
3. 支持时间线回溯、关键词检索、按机器人/房间过滤

### 7.5 OpenClaw 流式交互落地建议

当前 `OpenClawService.ts` 已具备流式基础，建议增强：

1. 增加统一的 `AbortController Registry`
   - 允许按 `roomId + botId + threadId` 中断
2. 增加 `traceId`
   - 便于 UI、消息、审计与错误日志串联
3. 对流式回复采用增量缓冲
   - 每 50-80ms 合并一次 UI 刷新，避免频繁渲染
4. 输出完成前不直接写房间
   - 先本地显示草稿态，完成后再落房间

## 8. 房间内机器人部署与交互设计

### 8.1 房间机器人存在模型

一期推荐采用“虚拟存在”方案，二期再升级到真实 Matrix Bot User：

1. 一期
   - 通过 `org.hula.bot.registry` 和 `org.hula.bot.presence` 在房间内展示机器人存在和状态
   - 优点是前端可先落地，无需等待服务端机器人用户体系
2. 二期
   - 为机器人分配真实 Matrix 用户身份
   - 支持真实成员列表、真实在线状态、独立权限与审计

### 8.2 状态机设计

机器人实例建议具备以下状态：

1. `idle`
2. `running`
3. `thinking`
4. `degraded`
5. `paused`
6. `error`
7. `offline`

状态变化由 `RobotPresenceService` 统一管理，并向房间和 UI 广播。

### 8.3 多房间多机器人并行模型

建议采用 `RobotRuntimeRegistry` 统一调度：

```ts
type RuntimeKey = `${roomId}:${botId}`
```

每个运行时包含：

1. 输入队列
2. 输出缓冲
3. 中断控制器
4. 状态机
5. 指标计数器
6. 最近错误

并发控制建议：

1. 单机器人实例串行消费
2. 不同房间的不同机器人允许并行
3. 对同用户的 OpenClaw 请求增加并发上限，避免单用户密钥被滥用

### 8.4 部署流程

建议房间内部署机器人流程如下：

1. 房间管理员打开“机器人面板”
2. 选择机器人模板
3. 配置作用范围
   - 全房间可见
   - 仅指定成员可用
   - 仅管理员可触发
4. 配置上下文权限
   - 可否读取最近 50/200/500 条消息
   - 可否使用附件
5. 保存为房间级 `org.hula.bot.registry` 状态
6. 前端运行时创建实例并开始监听

### 8.5 房间交互协议

房间中的机器人交互建议采用以下行为约束：

1. 机器人默认不监听全部消息，只监听：
   - 被 @
   - 明确 `/bot`
   - 命中触发规则
2. 机器人回复默认进入当前线程
3. 大段总结、日报、长文档输出优先转为链接卡片或折叠卡片
4. 机器人系统动作必须可审计，例如
   - 部署
   - 禁用
   - 修改权限
   - 清空记忆

## 9. 状态管理与模块设计

### 9.1 建议新增 Pinia Store

1. `robotCenterStore`
   - 全局机器人定义、可用插件、运行总览
2. `robotRuntimeStore`
   - 房间机器人运行时、状态、队列、错误
3. `robotPermissionStore`
   - 用户权限、房间权限、Bot 权限
4. `robotConversationStore`
   - 会话索引、草稿、历史过滤条件
5. `robotCredentialStore`
   - 非敏感凭证元数据

### 9.2 Store 设计原则

1. 业务逻辑放 Store action 中
2. 组件只负责调用 action 与展示状态
3. 不直接在组件中访问 Matrix SDK
4. 不在 Store 中长期保留 API Key 明文

## 10. 性能优化方案

### 10.1 首屏与模块加载

当前项目已有 Worker 和异步组件基础，机器人模块建议继续强化：

1. 机器人中心页、房间机器人面板、OpenClaw 工作台均采用按路由或按面板懒加载
2. Markdown、高亮、富文本卡片渲染拆到 Worker 或异步初始化
3. 机器人消息卡片渲染器按类型动态注册，避免一次性打包所有卡片组件

### 10.2 渲染优化

1. 消息列表使用虚拟滚动
2. 流式输出采用批量刷新策略
3. 卡片消息内容哈希缓存，避免重复 Markdown 解析
4. 机器人状态面板避免深层 watch，使用细粒度计算属性

### 10.3 数据与网络优化

1. 模型列表、本地机器人定义、卡片模板做 TTL 缓存
2. 房间机器人配置按 `roomId` 缓存并提供失效机制
3. 对同一机器人指令执行做请求去重
4. 离线重放按房间优先级和时间顺序执行

### 10.4 Worker 下沉建议

结合现有性能文档，优先将以下逻辑迁出主线程：

1. Markdown 预解析
2. 卡片模板渲染预处理
3. Prompt 脱敏和上下文裁剪
4. 长对话摘要预处理

### 10.5 预期性能目标

1. 机器人面板首次交互时间下降 30%-40%
2. 流式回复期间主线程长任务下降 50% 以上
3. 大房间中机器人消息渲染耗时下降 35% 以上
4. OpenClaw 工作台首屏包体缩减 15%-25%

## 11. 安全与隐私保护方案

### 11.1 API Key 保护

1. API Key 永不写入 `localStorage`
2. 长期凭证统一走系统安全存储
3. 浏览器兜底仅允许 `sessionStorage` + 会话加密，且默认不自动恢复
4. 日志中只展示掩码形式，如 `sk-****abcd`

### 11.2 对话隐私保护

1. 个人工作台默认私有存储
2. 房间机器人默认只读取必要上下文，不读取整个房间历史
3. 敏感房间支持“禁止机器人持久化对话”
4. 敏感消息支持 TTL 自动清理

### 11.3 权限控制体系

建议权限模型为：

1. `platform.robot.manage`
2. `platform.robot.provider.manage`
3. `room.robot.deploy`
4. `room.robot.invoke`
5. `room.robot.broadcast`
6. `room.robot.recall`
7. `room.robot.audit.read`

可与当前 `PermissionGuard` 和服务端能力接口联动。

### 11.4 审计与合规

建议新增机器人审计日志，记录：

1. 谁部署了机器人
2. 谁修改了房间权限
3. 谁绑定了 Provider
4. 谁发起了广播
5. 谁撤回了机器人消息

### 11.5 安全风险与控制措施

1. 风险: API Key 泄露
   - 控制: Keychain/Keystore + 掩码展示 + 禁止日志输出
2. 风险: Prompt 泄露
   - 控制: 对话内容加密存储 + 可配置不落盘
3. 风险: 机器人越权读取房间上下文
   - 控制: 房间级上下文窗口和成员级授权
4. 风险: 恶意链接卡片
   - 控制: 白名单域名 + URL 安全校验

## 12. 关键技术难点与解决方案

### 12.1 难点一: 房间机器人与个人 AI 工作台共存

问题:

- 当前 `robot` 与 `openclaw` 是两条相对独立链路，状态、消息与配置分散。

方案:

1. 抽出统一 `RobotRuntimeService`
2. 将 OpenClaw 视为一种 `RobotProvider`
3. 个人工作台与房间机器人共用同一 Provider / 凭证 / 会话基础设施

### 12.2 难点二: 富文本卡片跨客户端兼容

问题:

- 房间消息需要兼容不支持机器人卡片的客户端。

方案:

1. 始终提供 `body` 降级文本
2. 富文本使用 `formatted_body`
3. 卡片能力放在 `org.hula.bot` 扩展字段中

### 12.3 难点三: 流式生成与房间消息污染

问题:

- 若每个流式 chunk 都落房间，会产生大量碎片消息。

方案:

1. 本地草稿流式显示
2. 完成后一次性写入房间
3. 如需展示“思考中”，只更新状态，不发送中间消息

### 12.4 难点四: 已读回执一致性

问题:

- 机器人消息需要被追踪阅读情况，但回执可能延迟或离线。

方案:

1. 复用现有 `MatrixReceiptService`
2. 结合离线补发机制
3. 对重要消息增加“送达/已读”双状态展示

### 12.5 难点五: 多房间并行与资源竞争

问题:

- 多房间多机器人会争抢模型、连接与主线程资源。

方案:

1. 运行时注册表隔离实例
2. 对 OpenClaw 请求做并发池与速率限制
3. 长任务下沉 Worker
4. 大模型请求统一支持取消、超时与熔断

### 12.6 难点六: 历史记录隐私与检索能力冲突

问题:

- 既要加密历史内容，又希望支持检索与回溯。

方案:

1. 内容加密存储
2. 额外保存脱敏关键词索引
3. 检索命中后再解密原文展示

## 13. 分阶段实施步骤

### 13.1 阶段 0: 基线梳理与抽象统一

目标:

- 不改业务能力，先统一底层接口。

工作项:

1. 抽取 `RobotProviderAdapter` 接口
2. 抽取 `RobotCredentialService`
3. 抽取 `RobotConversationService`
4. 将 `plugins/robot` 与 `openclaw` 的共享逻辑下沉

产出:

1. 统一 Provider 层
2. 凭证服务
3. 会话服务

预计工期:

- 4-6 人日

### 13.2 阶段 1: 每用户 OpenClaw 安全接入

目标:

- 实现每用户独立模型与 API Key、安全存储、对话历史升级。

工作项:

1. 凭证以 `userId + provider` 维度管理
2. API Key 全面迁移到系统安全存储
3. 对话历史迁移到加密存储
4. UI 增加凭证管理、连接测试、删除与切换

产出:

1. 用户级 Provider 配置页
2. 加密历史存储
3. 凭证审计

预计工期:

- 6-8 人日

### 13.3 阶段 2: 房间机器人 MVP

目标:

- 支持在房间中部署机器人、@ 机器人、机器人回复与状态展示。

工作项:

1. 机器人定义与注册表
2. 房间机器人面板
3. 房间部署与禁用
4. 虚拟存在与状态显示
5. `@bot`、`/bot` 指令解析

产出:

1. 房间机器人 MVP
2. OpenClaw Assistant 房间版
3. 基础权限控制

预计工期:

- 8-10 人日

### 13.4 阶段 3: 智能推送与卡片消息

目标:

- 建设类钉钉式消息推送和卡片体系。

工作项:

1. 卡片消息协议
2. 推送中心与投递追踪
3. 已读面板
4. 机器人消息撤回
5. 广播与定向推送

产出:

1. 文本/富文本/链接卡片
2. 已读追踪
3. 撤回与审计

预计工期:

- 8-12 人日

### 13.5 阶段 4: 平台化与性能/安全增强

目标:

- 形成可扩展机器人平台。

工作项:

1. 插件动态加载
2. Worker 化
3. 熔断/降级/限流
4. 审计中心
5. 指标与异常看板

产出:

1. 可扩展平台底座
2. 监控与审计
3. 性能优化版工作台

预计工期:

- 10-15 人日

## 14. 推荐落地文件映射

### 14.1 建议保留并增强的现有文件

1. `src/services/openclaw/OpenClawService.ts`
   - 增加 traceId、并发池、房间上下文支持
2. `src/services/secure/robotAiProviderStorage.ts`
   - 从“单配置存储”升级为“用户级凭证管理”
3. `src/views/openclaw/OpenClawView.vue`
   - 继续作为个人工作台 UI
4. `src/plugins/robot/composables/useRobotChat.ts`
   - 逐步收敛为平台统一聊天编排层
5. `src/services/matrix/messaging/MatrixMessageService.ts`
   - 增加机器人卡片消息封装
6. `src/services/matrix/messaging/MatrixReceiptService.ts`
   - 增加机器人消息已读聚合接口

### 14.2 建议新增的关键文件

1. `src/services/robot/RobotRuntimeService.ts`
2. `src/services/robot/RobotDispatchService.ts`
3. `src/services/robot/RobotCredentialService.ts`
4. `src/services/robot/RobotPresenceService.ts`
5. `src/services/robot/RobotPermissionService.ts`
6. `src/services/robot/RobotAuditService.ts`
7. `src/modules/robot/protocols/message.ts`
8. `src/modules/robot/protocols/presence.ts`
9. `src/stores/domains/robot/center.ts`
10. `src/stores/domains/robot/runtime.ts`

## 15. 测试与验收建议

### 15.1 单元测试

1. 凭证读写与删除
2. 消息协议序列化与降级文本生成
3. 机器人状态机切换
4. 房间指令解析
5. 离线重放与幂等去重

### 15.2 集成测试

1. 用户绑定 OpenClaw Key -> 连接成功 -> 拉取模型
2. 房间部署机器人 -> @ 机器人 -> 收到回复
3. 机器人发送卡片 -> 成员查看 -> 已读人数更新
4. 机器人消息撤回 -> UI 正确反映

### 15.3 E2E 场景

1. 管理员部署机器人
2. 普通成员调用机器人
3. 非授权成员被拒绝
4. 网络断开后消息入队，恢复后自动重放
5. 切换账号后凭证隔离生效

### 15.4 验收指标

1. 房间机器人首轮交互成功率 > 95%
2. 机器人消息离线重放成功率 > 90%
3. API Key 明文零落盘
4. 大房间中机器人面板交互无明显卡顿

## 16. 实施成本评估

### 16.1 人力成本

建议最小配置：

1. 前端 2 人
2. Tauri/Rust 1 人
3. QA 1 人
4. 产品/设计 0.5 人

### 16.2 时间成本

若按阶段推进，建议排期如下：

1. 阶段 0-1: 2 周
2. 阶段 2: 2 周
3. 阶段 3: 2 周
4. 阶段 4: 2-3 周

总周期建议:

- 8-9 周

### 16.3 技术风险成本

主要风险包括：

1. OpenClaw 网关稳定性与限流策略不足
2. Matrix 自定义卡片协议与其他客户端兼容性
3. 加密历史记录带来的迁移复杂度
4. 多房间并发场景下的资源竞争

## 17. 预期效果评估

### 17.1 业务效果

1. 机器人从“独立 AI 页”升级为“房间协作助手”
2. 形成类似钉钉机器人的通知、卡片、命令和协作体验
3. 每用户自带模型与 Key，增强灵活性和企业接入能力
4. 房间支持多机器人并行，便于后续引入审批、公告、知识库、日报等机器人

### 17.2 技术效果

1. 统一机器人平台底座，降低后续 AI 功能接入成本
2. 复用现有 Matrix、Tauri、安全存储、离线队列能力，避免重复建设
3. 强化性能、安全、隐私和审计能力
4. 形成前端可扩展插件架构，为后续 MCP、Agent、工作流机器人预留空间

### 17.3 可量化收益

预计可带来：

1. AI 功能复用效率提升 40% 以上
2. 房间机器人需求接入周期缩短 30%-50%
3. 机器人交互的权限与审计问题显著降低
4. 用户对个人模型、自定义 API Key 的诉求可被正式支持

## 18. 最终建议

综合当前项目现状，建议采用“统一平台 + 分阶段升级”的路线，而不是继续在 `plugins/robot` 与 `views/openclaw` 上做零散补丁。

优先级建议如下：

1. 第一优先级: 用户级 OpenClaw 凭证安全化与历史记录加密化
2. 第二优先级: 房间机器人 MVP 与基础协议
3. 第三优先级: 卡片消息、已读追踪、撤回、广播能力
4. 第四优先级: 插件化、Worker 化、审计与监控

该路线与现有 HuLa 架构兼容，复用成本低，能够在 2 个月左右形成具有企业协同价值的类钉钉机器人系统。
