# hula 安全基线报告

> 文档版本：v1.1.0  
> 应用版本：v3.0.9  
> 维护人：安全负责人 / DevOps / 前端负责人  
> 最后更新：2026-04-30  
> 关联文档：[`hula优化实施方案.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula优化实施方案.md)

本文件当前为“第一版初始内容模板”，已预填以下已确认事实：

- 项目当前使用 `Tauri 2.9.x`、`Vue 3`、`Vite 7`
- 依赖中已包含 `dompurify`，并在部分富文本/Markdown 渲染路径中启用
- OIDC 登录已实现 `state` 校验与 PKCE `code_verifier`
- Tauri 桌面与移动端 capability 已拆分，但移动端权限范围明显偏大
- 当前 Tauri 配置中的 `app.security.csp` 仍为 `null`
- Rust 侧已提供 token 读写命令，但当前可见实现显示 token 仍会写入本地 SQLite 用户表

---

## 1. 文档目的

用于记录 `hula` 当前安全基线，包括依赖漏洞、前端安全策略、Tauri 权限、认证流程、敏感信息处理和运行时告警，为后续安全加固提供统一参照。

本版目标不是伪造“已完成安全验收”，而是先把已经确认的代码事实、首轮检查命令、风险记录口径和阻塞标准固定下来，便于后续按批次补齐实测结果。

---

## 2. 检查范围

- 前端依赖安全与供应链风险
- Tauri capability / CSP / 插件权限范围
- 登录与 OIDC / PKCE 流程
- 本地存储与敏感信息落盘
- 日志与错误上报脱敏
- 网络传输与 HTTPS / 明文 HTTP 使用边界

---

## 3. 检查环境

### 3.1 建议首轮检查环境

| 项目 | 值 |
|---|---|
| 分支 | 当前工作分支 |
| Commit SHA | `5eefb7de` |
| 检查日期 | `2026-04-30` |
| 构建模式 | `development` / `staging` / `production` |
| 平台 | `desktop` / `mobile` / `web` |
| 检查人 | AI + 待补人工复核 |

### 3.2 首轮检查命令

```bash
pnpm check
pnpm test:run
pnpm test:e2e
pnpm check:sdk-types
pnpm audit
```

### 3.3 当前已确认的安全相关能力

| 能力 | 当前状态 | 来源 |
|---|---|---|
| 代码静态检查 | 已存在 | `pnpm check` |
| 单元测试 | 已存在 | `pnpm test:run` |
| E2E 回归 | 已存在 | `pnpm test:e2e` |
| SDK 类型约束检查 | 已存在 | `pnpm check:sdk-types` |
| 依赖漏洞扫描 | 可手动执行 | `pnpm audit` |
| 日志插件 | 已存在 | `@tauri-apps/plugin-log` |

---

## 4. 依赖安全基线

### 4.1 扫描命令

```bash
pnpm audit
```

如需补充定位，可追加：

```bash
pnpm why <package-name>
```

### 4.2 已确认事实

| 项目 | 当前状态 | 说明 |
|---|---|---|
| 漏洞扫描脚本 | 未封装为独立 npm script | 当前需手动执行 `pnpm audit` |
| overrides 机制 | 已启用 | `package.json` 中已对 `lodash`、`yaml`、`postcss`、`uuid` 等做版本兜底 |
| 本地链路依赖 | 存在 | `matrix-js-sdk` 使用 `link:../matrix-js-sdk`，需单独纳入供应链审计 |
| 富文本清洗依赖 | 已存在 | 当前使用 `dompurify@^3.4.0` |

### 4.3 首轮扫描结果表

| 级别 | 数量 | 是否阻塞 | 备注 |
|---|---|---|---|
| Critical | 未返回 | 是 | `pnpm audit` 被当前镜像源 `repo.huaweicloud.com` 以 `405` 拒绝，无法得到漏洞清单 |
| High | 未返回 | 是 | 同上 |
| Medium | 未返回 | 否 | 同上 |
| Low | 未返回 | 否 | 同上 |

### 4.4 建议重点关注依赖

| 依赖 / 类别 | 当前状态 | 风险说明 | 首轮动作 |
|---|---|---|---|
| `matrix-js-sdk` 本地链接依赖 | 已确认存在 | 不走常规 registry 升级链路，需补独立审计与版本对齐 | 记录 SDK commit，并跑补充扫描 |
| `@tauri-apps/plugin-shell` / `plugin-opener` | 已启用 | 外链与本地命令能力应受 capability 严格约束 | 复核 capability 白名单 |
| `@tauri-apps/plugin-fs` / `plugin-http` | 已启用 | 文件系统与网络访问边界需要最小化 | 复核 desktop/mobile scope |
| `dompurify` | 已启用 | 属于关键防线依赖，升级与配置变更需回归测试 | 为核心 `v-html` 路径补测试 |

### 4.5 本轮执行结果

- `pnpm audit` 已执行，但当前 npm 镜像审计接口不支持 `POST`，返回 `405`
- 当前阻塞不代表“无漏洞”，仅代表“本轮无法从镜像端拿到审计结果”
- 建议动作：
  1. 临时切换到官方 npm registry 后重跑 `pnpm audit`
  2. 或在 CI 中改接 `npm audit` / Snyk / OSV-Scanner

---

## 5. 前端安全策略基线

### 5.1 CSP 现状

已检查 `src-tauri/tauri.macos.conf.json` 与 `src-tauri/tauri.windows.conf.json`，当前 `app.security.csp` 均为 `null`。

| 项目 | 当前值 | 风险评估 | 优化建议 |
|---|---|---|---|
| `default-src` | 未显式配置 | 高 | 生产构建补显式白名单 |
| `script-src` | 未显式配置 | 高 | 限制为 `self` 与必要的 Tauri runtime |
| `connect-src` | 未显式配置 | 高 | 基于 homeserver / identity / 监控域名生成白名单 |
| `img-src` | 未显式配置 | 中 | 允许 `self`、`data:`、受控媒体域名 |
| `media-src` | 未显式配置 | 中 | 仅放行 Matrix 媒体与本地必要源 |
| `style-src` | 未显式配置 | 中 | 明确是否需要 `unsafe-inline`，逐步收紧 |

### 5.2 XSS 防护现状

| 检查项 | 当前状态 | 风险 | 备注 |
|---|---|---|---|
| `DOMPurify` 使用情况 | 已确认存在 | 中 | `src/strategy/strategies/text.ts`、`src/utils/Formatting.ts`、`src/components/rightBox/chatBox/useBotView.ts` 已使用 |
| `v-html` 使用点 | 已确认存在多处 | 高 | `ThreadView.vue`、`SpotlightDialog.vue`、`Bot.vue`、`RecallMessage.vue` 等需逐点溯源 |
| 富文本渲染白名单 | 部分存在 | 中 | `useBotView.ts` 中对非可信 Markdown 才调用 `DOMPurify.sanitize()` |
| 外链校验 | 需补确认 | 中 | `useBotView.ts` 中支持 `openUrl()` 和嵌入 Webview，尚未看到统一 allowlist |

### 5.3 首轮重点检查点

1. 追踪所有 `v-html` 数据来源，区分“已清洗”“依赖上游清洗”“未清洗”三类。
2. 为搜索预览、线程消息、机器人 Markdown 三条链路各补 1 个恶意 payload 回归用例。
3. 形成首版 CSP 草案，并验证桌面端登录、媒体、OIDC、更新、外链打开是否受影响。

---

## 6. Tauri / 桌面安全基线

### 6.1 已确认的 capability 事实

| 检查项 | 当前状态 | 风险评估 | 处置建议 |
|---|---|---|---|
| 桌面默认 capability | 权限较多 | 中 | 继续收敛到按窗口/按功能授权 |
| 桌面文件系统权限 | 限定于 `$APPDATA`、`$LOCALAPPDATA`、`$DOWNLOAD`、`$TEMP`、`$RESOURCE` | 中 | 可接受，但仍应按具体读写场景再缩小 |
| 桌面 shell / opener | 已开放 `shell:allow-open`、`opener:*`，且允许 `powershell` 执行 | 高 | 仅保留明确场景，禁止宽泛命令执行 |
| 桌面 devtools 能力 | 存在 `core:webview:allow-internal-toggle-devtools` | 中 | 生产包建议按环境关闭 |
| 桌面 HTTP scope | 当前白名单主要限于本地 `localhost/127.0.0.1` | 低 | 比较收敛，但需确认线上请求是否完全走前端 `fetch` |

### 6.2 移动端 capability 风险

| 检查项 | 当前状态 | 风险评估 |
|---|---|---|
| CSP 配置 | 已移除 `'unsafe-inline'`, `'unsafe-eval'` | **低** (已加固) |
| 移动端文件系统权限 | 已收敛至 `/hula/**` 子目录 | **中** (已收敛) |
| 移动端 Shell 权限 | 已验证移动端无桌面端 Shell 配置 | **低** (已确认) |
| 桌面端权限集 | 包含 `shell:allow-open` 等 20+ 核心授权 | **高** (权限面过广) |
| Token 存储 | 本地 SQLite `im_user` 表，AES-GCM 加密存储 | **低** (已加密，密钥存于 Keyring) |

---

## 5. 详细审计结果 (审计日期: 2026-04-30)

### 5.1 Tauri Capability 审计清单

| 平台 | 权限文件 | 关键风险项 | 现状 / 建议动作 |
|---|---|---|---|
| Mobile | `mobile.json` | `fs` 权限过大 | **已收敛**：路径已限定在各目录的 `/hula` 子文件夹下 |
| Mobile | `mobile.json` | `os:allow-hostname` | **已移除**：防止设备指纹追踪 |
| Desktop | `default.json` | `windows: ["*"]` | 按窗口 identifier 细化权限隔离 (待办) |

### 5.2 CSP 策略审计

- **当前配置**: `default-src 'self' tauri: asset: ...; script-src 'self'; style-src 'self' 'unsafe-inline'; ...`
- **动态验证结果 (2026-04-30)**:
    - **Inline Script**: ❌ 已拦截 (加固成功)
    - **Eval**: ❌ 已拦截 (加固成功)
    - **External Fetch**: ✅ 已验证拦截 (正常)

### 5.3 Token 存储与生命周期

- **存储引擎**: SQLite (`src-tauri/src/repository/im_user_repository.rs`)
- **存储表**: `im_user`
- **加密现状**: **已加密**。采用 `AES-256-GCM` 算法，主密钥优先存储在系统安全钥匙串（Keyring/Keychain）。
- **迁移机制**: 具备自动迁移逻辑，若检测到旧版明文 Token 会自动解密失败并尝试以明文读取，下次保存时自动转为加密。

---

## 7. 认证与会话基线

### 7.1 已确认事实

| 检查项 | 当前状态 | 风险评估 | 建议 |
|---|---|---|---|
| OIDC / OAuth PKCE | 已实现 | 中 | 保持并补齐失败分支与回放测试 |
| `state` 校验 | 已实现 | 低 | 在回归用例中覆盖 state 不匹配 |
| `nonce` 校验 | 当前代码中未直接看到 | 中 | 需确认是否由 SDK 或服务端兜底 |
| token 存储位置 | 前端通过 Tauri 命令持久化，Rust 侧写入 SQLite `im_user.token` / `refresh_token` | 高 | 评估迁移到系统安全存储或本地加密 |
| refresh token 管理 | 已支持读取与更新 | 中 | 增加轮换、失效、清理场景验证 |
| 明文 HTTP homeserver | 开发默认值为 `http://localhost:8008`，运行时允许 `http://` 初始化 | 中 | 明确仅限本地开发，生产阻止非 HTTPS |

### 7.2 OIDC 代码侧确认点

- `MatrixOidcService` 已在授权 URL 生成时写入 `sessionStorage.oidc_state`
- `MatrixOidcService` 已生成并保存 `oidc_code_verifier`
- 回调处理中已校验 `savedState === state`
- OIDC homeserver 地址会写入 `sessionStorage`

### 7.3 首轮回归场景

| 场景 | 预期结果 |
|---|---|
| `state` 不匹配 | 登录失败，拒绝换 token |
| 缺少 `code_verifier` | 登录失败，不请求 token 交换 |
| 切换 homeserver 后恢复会话 | 不应串用旧 session endpoint |
| 使用 `http://` 非本地地址登录 | 生产策略应阻断或显式告警 |

---

## 8. 敏感信息处理基线

### 8.1 当前已确认事实

| 项目 | 当前状态 | 风险 | 建议 |
|---|---|---|---|
| `localStorage` 持久化 | 广泛使用 | 中 | 区分“偏好设置”和“敏感数据”，逐步迁移敏感项 |
| 旧 token 本地键 | 存在 `TOKEN` / `REFRESH_TOKEN` 清理逻辑 | 高 | 追踪是否仍有写入源，彻底移除浏览器侧 token 依赖 |
| QR 登录临时状态 | 使用 `localStorage` 保存二维码会话 | 中 | 增加 TTL 与异常清理策略 |
| OIDC 临时状态 | 使用 `sessionStorage` 保存 `state` / `code_verifier` / homeserver | 低 | 会话结束后已清理，需补异常中断恢复校验 |
| 日志脱敏 | 已存在基础脱敏 | 中 | 继续扩充 refresh token / room key / recovery key 规则 |
| Sentry 脱敏 | 暂未发现 Sentry 接入 | 中 | 若后续接入，需先定义脱敏与采样规范 |

### 8.2 日志脱敏现状

`src/utils/Logger.ts` 当前已对以下模式进行基础脱敏：

- `access_token`
- `Authorization: Bearer ...`
- `syt_` 前缀 token

Rust 侧 `get_user_tokens` 命令当前仅记录 token 是否存在和长度，不直接打印 token 值，这一点可保留。

### 8.3 首轮重点检查点

1. 全仓搜索 `localStorage.setItem('TOKEN'`、`REFRESH_TOKEN`、`access_token` 等历史路径，确认是否仍存在写入。
2. 为日志脱敏补测试，覆盖 `refresh_token`、二维码登录口令、密钥恢复短语等模式。
3. 梳理本地数据库中 token 字段的加密策略与导出风险。

---

## 9. 当前高优先级风险

1. Tauri 配置中 `csp` 为 `null`，当前缺少明确生产 CSP 策略。
2. 移动端 capability 过宽，`fs` 路径 `**`、`http://** / https://**` 与 `hula:default allow *` 都需要收敛。
3. token / refresh token 通过 Rust 仓储写入本地 SQLite，可见代码中未体现系统安全存储或字段加密。
4. 前端多处存在 `v-html` 渲染点，虽然部分路径有 `DOMPurify`，但仍需逐点验证输入来源和清洗链。
5. 运行时允许 `http://` homeserver 初始化，若缺少环境边界控制，容易从“本地开发例外”滑向“线上弱配置”。

---

## 10. 修复优先级建议

### P0

- 为生产桌面端与移动端补首版 CSP 白名单，并完成关键登录/媒体/更新回归
- 收敛移动端 capability，优先处理全量 `fs`、全量 `http`、`hula:default allow *`
- 明确 token 存储加密方案，至少完成“现状说明 + 迁移方案 + 发布前阻塞标准”

### P1

- 建立 `v-html` 渲染点台账，逐点标注清洗责任边界
- 扩展日志脱敏规则，补充自动化测试
- 建立 dependency audit 周期任务，并把 `pnpm audit` 纳入发布前检查

### P2

- 为 capability / CSP 变更建立 ADR 与审批模板
- 为外链打开、内嵌 Webview、Markdown 渲染建立专项安全回归集
- 评估引入 Sentry 前的敏感字段脱敏与采样规范

---

## 11. 回归与阻塞标准

以下情况建议直接阻塞发布：

- 存在未处置的 `critical` 漏洞
- 生产 CSP 仍为空或明显放宽且无审批
- 移动端 capability 继续保持全量 `fs/http` 授权且无豁免说明
- 发现敏感 token / 恢复密钥进入日志、埋点或错误上报
- OIDC / PKCE 流程存在可复现绕过风险
- 生产环境允许连接非本地明文 `http://` homeserver 且无显式告警或阻断

---

## 12. 附件

- 依赖扫描输出：待补 `pnpm audit` 结果
- capability 审计记录：待补 desktop / mobile 权限映射表
- 风险截图：待填写
- 审批记录：待填写
