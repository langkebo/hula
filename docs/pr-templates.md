# hula PR 模板库

> 文档版本：v1.0.0  
> 应用版本：v3.0.9  
> 维护人：项目维护者 / 前端负责人 / Rust 负责人 / QA 负责人  
> 最后更新：2026-04-30  
> 关联文档：[`issue-templates.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-templates.md) / [`issue-backlog.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-backlog.md) / [PULL_REQUEST_TEMPLATE.md](file:///Users/ljf/Desktop/hu_ts/hula/.github/PULL_REQUEST_TEMPLATE.md)

---

## 1. 文档目的

用于为优化计划执行阶段提供标准 PR 模板，确保每个 PR 都能明确说明：

- 对应的 Issue / Task ID
- 改动范围与风险
- 基线对比、CI 结果与附件
- 灰度方式与回滚策略

本文件不替代仓库现有的通用 PR 模板，而是作为优化任务专用模板库，与 [PULL_REQUEST_TEMPLATE.md](file:///Users/ljf/Desktop/hu_ts/hula/.github/PULL_REQUEST_TEMPLATE.md) 搭配使用。

---

## 2. 与现有模板的关系

### 2.1 当前仓库已有模板

仓库当前已存在简版 PR 模板，见 [PULL_REQUEST_TEMPLATE.md](file:///Users/ljf/Desktop/hu_ts/hula/.github/PULL_REQUEST_TEMPLATE.md#L1-L23)。

其优点：

- 适合日常小改动
- 已覆盖变更类型选择
- 使用成本低

其不足：

- 没有 `Task ID / Issue ID`
- 没有验收标准回填
- 没有灰度与回滚说明
- 没有性能、安全、bundle 类附件要求

### 2.2 建议使用方式

- 日常小型 PR：继续使用现有 `.github` 模板
- 优化专项 PR：在现有模板基础上，额外复制本文件对应段落
- 如果后续需要统一收口，可再把本文件内容合并回 `.github/PULL_REQUEST_TEMPLATE.md`

---

## 3. 通用优化 PR 模板

复制以下模板后，替换尖括号内容：

```md
#### 💻 变更类型 | Change Type

- [ ] ✨ feat | 新增功能
- [ ] 🐛 fix | 修复缺陷
- [ ] ♻️ refactor | 代码重构
- [ ] 📦️ build | 构建流程、外部依赖变更
- [ ] 🚀 perf | 性能优化
- [ ] 📝 docs | 文档变更
- [ ] 🧪 test | 测试改动
- [ ] ⚙️ ci | CI 配置调整
- [ ] 🛠️ chore | 辅助性变更

#### 🔗 关联任务 | Linked Task

- Task ID: `<P0-XXX-XX>`
- Issue: `<#123>`
- 关联文档：`<docs/...>`

#### 🔀 变更说明 | Description of Change

<一句话说明本 PR 做了什么>

#### 📦 改动范围 | Scope

- 包含：
- 不包含：

#### ✅ 验收结果 | Acceptance

- [ ] 已满足对应 Issue 的验收标准
- [ ] 已补充或更新相关文档
- [ ] 已补充或更新相关测试

#### 🧪 验证记录 | Validation

- 本地验证：
- CI 验证：
- 人工验证：

#### 📊 指标/附件 | Metrics & Artifacts

- 性能数据：
- Bundle 数据：
- 安全扫描：
- 截图 / trace / 日志：

#### ⚖️ 体积与性能门禁 (专项) | Bundle & Perf Budget

| 检查项 | 变更值 | 预算/基线 | 状态 | 备注 |
|---|---|---|---|---|
| JS Bundle (Gzip) | `<+XX KB>` | `< 500 KB` | `<✅/❌>` | |
| LCP | `<+/- XX ms>` | `< 2.5s` | `<✅/❌>` | |
| INP | `<+/- XX ms>` | `< 200ms` | `<✅/❌>` | |

> 若超出预算，必须在下方说明原因及后续优化计划。

#### ⚠️ 风险与影响 | Risks

- 风险：
- 影响面：
- 依赖：

#### ↩️ 灰度与回滚 | Rollout & Rollback

- 灰度方式：
- 回滚方式：
- 回滚触发条件：

#### 📝 补充信息 | Additional Information

<其他需要评审关注的信息>
```

---

## 4. 首批 P0 PR 模板

### 4.1 `P0-PERF-01` 建立首轮性能基线

建议标题：

```md
[P0][性能] 建立首轮性能基线
```

建议正文：

```md
#### 💻 变更类型 | Change Type

- [x] 📝 docs | 文档变更
- [x] 🚀 perf | 性能优化
- [x] 🧪 test | 测试改动

#### 🔗 关联任务 | Linked Task

- Task ID: `P0-PERF-01`
- Issue: `<待替换>`
- 关联文档：`docs/baseline/performance-baseline.md`

#### 🔀 变更说明 | Description of Change

建立首轮性能基线，补充 Web-Vitals、典型场景记录、trace/录屏归档与首轮瓶颈结论。

#### 📦 改动范围 | Scope

- 包含：性能基线文档更新、采样记录、必要的埋点或测试补充
- 不包含：大规模性能重构

#### ✅ 验收结果 | Acceptance

- [ ] 已完成至少 2 个环境 ID 的首轮采样
- [ ] 已回填 Web-Vitals 表
- [ ] 已完成场景 A/B/C 至少 1 轮记录
- [ ] 已输出首轮性能瓶颈结论

#### 🧪 验证记录 | Validation

- 本地验证：`pnpm check` / `pnpm test:run` / `pnpm test:e2e`
- CI 验证：如有，贴 workflow 结果链接
- 人工验证：记录采集环境和样本数

#### 📊 指标/附件 | Metrics & Artifacts

- 性能数据：`performance-baseline.md`
- 截图 / trace / 日志：补附件链接
- 录屏：补附件链接

#### ⚠️ 风险与影响 | Risks

- 风险：采样方法不一致导致数据不可比
- 影响面：仅文档与基线资产，不直接影响生产逻辑
- 依赖：本地 Matrix 服务与运行环境稳定

#### 🚦 灰度与回滚 | Rollout & Rollback

- 灰度方式：无，此 PR 为基线采集
- 回滚方式：移除错误采样结果并重新采集
- 回滚触发条件：样本失真或环境标签错误

#### 📝 补充信息 | Additional Information

- 建议在 PR 中附上 3 份代表性 trace 或录屏
```

### 4.2 `P0-BUNDLE-01` 建立 desktop / mobile 首轮 bundle 基线

建议标题：

```md
[P0][构建] 建立 desktop / mobile 首轮 bundle 基线
```

建议正文：

```md
#### 💻 变更类型 | Change Type

- [x] 📦️ build | 构建流程、外部依赖变更
- [x] 📝 docs | 文档变更

#### 🔗 关联任务 | Linked Task

- Task ID: `P0-BUNDLE-01`
- Issue: `<待替换>`
- 关联文档：`docs/baseline/bundle-baseline.md`

#### 🔀 变更说明 | Description of Change

建立 desktop / mobile 双端首轮 bundle 基线，归档构建分析结果、最重资产清单与首批拆分建议。

#### 📦 改动范围 | Scope

- 包含：构建产物采集、bundle 基线文档更新、分析产物归档
- 不包含：直接实施拆包或懒加载改造

#### ✅ 验收结果 | Acceptance

- [ ] 已完成 desktop 产物采集
- [ ] 已完成 mobile 产物采集
- [ ] 已识别最重 10 个资产
- [ ] 已识别超过阈值的 JS 资产
- [ ] 已输出首批懒加载或拆分建议

#### 🧪 验证记录 | Validation

- 本地验证：`pnpm build` / `pnpm metrics:bundle` / `pnpm analyze`
- CI 验证：关联 [security-performance.yml](file:///Users/ljf/Desktop/hu_ts/hula/.github/workflows/security-performance.yml) 中 bundle 产物
- 人工验证：确认 desktop / mobile 数据未混填

#### 📊 指标/附件 | Metrics & Artifacts

- `dist/bundle-metrics.json`
- 构建日志
- `stats.html` 或等价分析产物
- 最重 10 个资产清单

#### ⚠️ 风险与影响 | Risks

- 风险：环境变量差异导致构建结果不可比
- 影响面：仅文档、分析产物与基线数据
- 依赖：构建链路稳定可运行

#### 🚦 灰度与回滚 | Rollout & Rollback

- 灰度方式：无，此 PR 为基线采集
- 回滚方式：移除错误产物并重新构建归档
- 回滚触发条件：采集结果缺失、产物口径不一致

#### 📝 补充信息 | Additional Information

- 建议在 PR 描述中贴出 top 5 bundle 资产摘要
```

### 4.3 `P0-SEC-01` 补齐生产 CSP 基线

建议标题：

```md
[P0][安全] 补齐生产 CSP 基线
```

建议正文：

```md
#### 💻 变更类型 | Change Type

- [x] 🐛 fix | 修复缺陷
- [x] 📝 docs | 文档变更
- [x] ⚙️ ci | CI 配置调整

#### 🔗 关联任务 | Linked Task

- Task ID: `P0-SEC-01`
- Issue: `<待替换>`
- 关联文档：`docs/baseline/security-baseline.md`

#### 🔀 变更说明 | Description of Change

为生产构建补充显式 CSP 配置，并完成登录、OIDC、媒体、更新、外链等关键路径回归。

#### 📦 改动范围 | Scope

- 包含：Tauri 配置调整、CSP 草案、回归记录、文档更新
- 不包含：capability 全量收敛与 token 存储方案

#### ✅ 验收结果 | Acceptance

- [ ] 生产配置不再为 `csp: null`
- [ ] 已形成可审查的 CSP 白名单
- [ ] 关键流程回归通过
- [ ] 已补充回滚说明

#### 🧪 验证记录 | Validation

- 本地验证：关键登录与媒体链路手工回归
- CI 验证：关联 [security-performance.yml](file:///Users/ljf/Desktop/hu_ts/hula/.github/workflows/security-performance.yml) 或相关 workflow
- 人工验证：记录被拦截资源与必要放行项

#### 📊 指标/附件 | Metrics & Artifacts

- CSP 配置 diff
- 回归截图 / 日志
- 受影响资源清单

#### ⚠️ 风险与影响 | Risks

- 风险：策略过严导致关键链路失败
- 风险：策略过宽导致安全收益不足
- 影响面：桌面端 / 移动端生产构建

#### 🚦 灰度与回滚 | Rollout & Rollback

- 灰度方式：先预发或内部测试包验证
- 回滚方式：恢复到上一版 CSP 配置并重新构建
- 回滚触发条件：登录、OIDC、媒体、更新、外链任一关键路径阻断

#### 📝 补充信息 | Additional Information

- 如果存在例外放行项，请在 PR 中逐项说明原因
```

### 4.4 `P0-SEC-02` 收敛移动端 capability

建议标题：

```md
[P0][安全] 收敛移动端 capability
```

建议正文：

```md
#### 💻 变更类型 | Change Type

- [x] 🐛 fix | 修复缺陷
- [x] 📝 docs | 文档变更

#### 🔗 关联任务 | Linked Task

- Task ID: `P0-SEC-02`
- Issue: `<待替换>`
- 关联文档：`docs/baseline/security-baseline.md`

#### 🔀 变更说明 | Description of Change

按最小权限原则收敛移动端 capability，补充 capability-to-feature 映射表，并验证扫码、通知、录音、文件读写等核心路径。

#### 📦 改动范围 | Scope

- 包含：移动端 capability 配置调整、映射表、核心路径回归
- 不包含：桌面端全量权限收敛

#### ✅ 验收结果 | Acceptance

- [ ] 不再保留无说明的全量 `fs` 授权
- [ ] 不再保留无说明的全量 `http/https` 授权
- [ ] `hula:default allow *` 已替换为明确 scope
- [ ] capability-to-feature 映射表已归档

#### 🧪 验证记录 | Validation

- 本地验证：移动端关键路径回归
- CI 验证：如有，附上移动端 smoke 结果
- 人工验证：扫码、通知、录音、文件读写逐项记录

#### 📊 指标/附件 | Metrics & Artifacts

- capability diff
- 映射表
- 回归结果记录

#### ⚠️ 风险与影响 | Risks

- 风险：权限缩小后功能异常
- 影响面：移动端扫码、录音、文件、通知相关流程
- 依赖：需要前端、移动端、Rust 共同确认调用链

#### 🚦 灰度与回滚 | Rollout & Rollback

- 灰度方式：内部测试包先行
- 回滚方式：恢复上一版 capability 配置
- 回滚触发条件：核心路径出现功能阻断

#### 📝 补充信息 | Additional Information

- 建议在 PR 中附 capability-to-feature 表的最终版本
```

### 4.5 `P0-SEC-03` 明确 token 存储加密方案

建议标题：

```md
[P0][安全] 明确 token 存储加密方案
```

建议正文：

```md
#### 💻 变更类型 | Change Type

- [x] 📝 docs | 文档变更
- [x] ♻️ refactor | 代码重构
- [x] 🧪 test | 测试改动

#### 🔗 关联任务 | Linked Task

- Task ID: `P0-SEC-03`
- Issue: `<待替换>`
- 关联文档：`docs/baseline/security-baseline.md`

#### 🔀 变更说明 | Description of Change

梳理 token 当前存储路径和风险面，补充正式的 token 存储加密 / 迁移方案，并在必要时提交兼容性代码。

#### 📦 改动范围 | Scope

- 包含：现状梳理、方案文档、必要代码调整、迁移说明
- 不包含：服务端协议变更

#### ✅ 验收结果 | Acceptance

- [ ] 已输出正式方案文档
- [ ] 已明确迁移步骤
- [ ] 已明确回滚说明
- [ ] 已明确发布阻塞条件

#### 🧪 验证记录 | Validation

- 本地验证：登录、自动登录、会话恢复回归
- CI 验证：相关单测或集成测试结果
- 人工验证：旧数据兼容读取与新写入路径验证

#### 📊 指标/附件 | Metrics & Artifacts

- 方案评审记录
- token 链路图
- 兼容测试记录

#### ⚠️ 风险与影响 | Risks

- 风险：迁移影响自动登录或 token 恢复
- 风险：多端兼容路径复杂
- 影响面：认证与会话恢复链路

#### 🚦 灰度与回滚 | Rollout & Rollback

- 灰度方式：先兼容读取，再切换默认写入
- 回滚方式：恢复旧写入路径并保留兼容读取
- 回滚触发条件：登录恢复失败率上升或 token 丢失

#### 📝 补充信息 | Additional Information

- 推荐在 PR 中附推荐方案与备选方案对比
```

---

## 5. 与现有 CI 的映射建议

| 场景 | 建议在 PR 中引用的 CI / 产物 |
|---|---|
| 性能基线 PR | [performance.yml](file:///Users/ljf/Desktop/hu_ts/hula/.github/workflows/performance.yml) |
| Bundle / 安全 PR | [security-performance.yml](file:///Users/ljf/Desktop/hu_ts/hula/.github/workflows/security-performance.yml) |
| 发布相关 PR | [release.yml](file:///Users/ljf/Desktop/hu_ts/hula/.github/workflows/release.yml) |
| 常规代码质量 PR | `style-check.yml` / `sdk-check.yml` / `codeql.yml` |

建议在 PR 中至少补以下结果之一：

- workflow 链接
- 关键步骤截图
- `GITHUB_STEP_SUMMARY` 摘要
- 上传工件名称

---

## 6. 后续补充建议

- 下一批可补 `P0-PERF-02`、`P0-BUNDLE-02`、`P1-SEC-01`
- 如果后续统一升级 `.github/PULL_REQUEST_TEMPLATE.md`，建议从“通用优化 PR 模板”中选最小必要字段合并
- 如果后续接入 GitHub PR Forms，可将本文件转换为结构化表单
