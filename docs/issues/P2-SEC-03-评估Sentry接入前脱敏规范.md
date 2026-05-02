# [P2][安全] 评估 Sentry 接入前脱敏规范

## 背景

为了提升线上问题的排查效率，计划接入 Sentry 等错误监控系统。但在接入前，必须制定严格的数据脱敏（Sanitization）规范，防止用户聊天内容、Token 或私钥随错误日志上传至第三方服务器。

## 现状

- 当前行为：尚未正式接入生产级 Sentry。
- 已知风险：默认的 Sentry 收集器可能捕获 UI 上的敏感文本（如输入框内容）或网络请求中的 Auth Header。
- 影响范围：用户隐私与数据合规。

## 目标

- 目标 1：定义“绝对禁止上传”的数据清单。
- 目标 2：配置 Sentry SDK 的 `beforeSend` 钩子进行全量脱敏。
- 目标 3：设定事件采样率，减少隐私泄露的概率。

## 范围

### 包含

- 错误堆栈中的上下文变量脱敏。
- 网络面包屑（Breadcrumbs）中的 URL 参数与 Header 脱敏。
- 用户标识符（UID）的哈希处理。

### 不包含

- Sentry 服务器端的安全配置（属于运维范畴）。

## 交付物

- 文档：Sentry 接入隐私与安全规范。
- 代码：预研性质的 `Sentry.init` 配置模板。

## 执行步骤

1. 调研 Sentry 官方的 `data-masking` 最佳实践。
2. 列出 `hula` 中常见的敏感对象（如 `MatrixEvent`, `RoomState`）。
3. 编写脱敏正则和黑名单字段过滤函数。
4. 模拟严重错误，检查发送给 Sentry 的 Mock 数据中是否包含敏感词。

## 验收标准

- [ ] 产出的脱敏规范通过 Security 评审。
- [ ] 脱敏逻辑能自动覆盖 90% 以上的常见 Auth 字段。
- [ ] 确立了“必须经过审批才能增加新的数据采集项”的制度。

## 风险与依赖

- 风险：脱敏过度可能导致错误堆栈难以调试。
- 依赖：无。

## 灰度与回滚

- 灰度方式：先在 Beta 分支小范围接入，仅收集 Crash 信息。
- 回滚方式：立即禁用 Sentry DSN 或回滚代码。

## 附件

- 参考文档：[Sentry Data Privacy](https://docs.sentry.io/product/data-management-settings/privacy/)
