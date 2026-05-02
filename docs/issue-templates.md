# hula Issue 模板库

> 文档版本：v1.0.0  
> 应用版本：v3.0.9  
> 维护人：项目维护者 / 前端负责人 / Rust 负责人 / QA 负责人  
> 最后更新：2026-04-30  
> 关联文档：[`issue-backlog.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-backlog.md) / [`hula优化实施方案.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula优化实施方案.md)

---

## 1. 文档目的

用于为 `hula` 优化执行阶段提供可直接复制的标准 Issue 模板，减少建单时重复整理背景、目标、验收标准和回滚策略的成本。

本文件优先覆盖首批建议立即创建的 `P0` 任务，后续可按同一结构继续补充 `P1 / P2` 模板。

---

## 2. 通用建单模板

复制以下模板后，替换尖括号内容：

```md
## 背景

<说明当前问题、来源文档、为什么现在要做>

## 现状

- 当前行为：
- 已知风险：
- 影响范围：

## 目标

- 目标 1：
- 目标 2：
- 目标 3：

## 范围

### 包含

- 

### 不包含

- 

## 交付物

- 文档：
- 代码：
- 测试：
- 附件：

## 执行步骤

1. 
2. 
3. 

## 验收标准

- [ ] 
- [ ] 
- [ ] 

## 风险与依赖

- 风险：
- 依赖：

## 灰度与回滚

- 灰度方式：
- 回滚方式：
- 回滚触发条件：

## 附件

- 参考文档：
- 截图 / trace / 日志：
```

---

## 3. 首批 P0 模板

### 3.1 `P0-PERF-01` 建立首轮性能基线

建议标题：

```md
[P0][性能] 建立首轮性能基线
```

建议正文：

```md
## 背景

当前优化方案已经明确“先测量，后优化”，但项目尚未形成统一、可追踪、可复测的首轮性能基线数据。现需基于 `docs/baseline/performance-baseline.md` 完成第一轮基线采集，为后续首屏优化、列表优化和 Worker 化提供依据。

## 现状

- 当前已接入 `WebVitalsObserver`
- 已可采集 `FCP / LCP / INP / CLS / TTFB / longtask`
- 已有 `pnpm check`、`pnpm test:run`、`pnpm test:e2e`、`pnpm metrics:bundle`
- `performance-baseline.md` 仍处于“待采集”状态

## 目标

- 建立开发态与类生产态的首轮性能基线
- 固化首屏、列表、滚动、登录恢复的首轮数据
- 为后续优化任务提供统一对比口径

## 范围

### 包含

- `desktop-dev-macos`
- `web-dev-chrome`
- `desktop-prod-like`
- Web-Vitals、trace、录屏、日志归档

### 不包含

- 直接进行性能重构
- 改动业务逻辑

## 交付物

- 已填写的 `docs/baseline/performance-baseline.md`
- 首轮 trace 文件
- 首轮录屏
- Web-Vitals 结果表
- 首轮瓶颈结论

## 执行步骤

1. 按文档要求准备 3 组环境
2. 执行 `pnpm check`、`pnpm test:run`、`pnpm test:e2e`
3. 运行 `pnpm dev`、`pnpm tauri:dev` 完成基线采样
4. 填写 Web-Vitals、典型场景 A/B/C/D 记录表
5. 归档 trace、录屏、日志与 commit SHA
6. 输出首轮瓶颈总结

## 验收标准

- [ ] `performance-baseline.md` 至少完成 2 个环境 ID 的首轮数据填写
- [ ] Web-Vitals 表已填充
- [ ] 场景 A/B/C 至少完成 1 轮记录
- [ ] 已输出首轮性能瓶颈结论

## 风险与依赖

- 风险：环境不稳定导致数据不可比
- 风险：开发态与类生产态混填
- 依赖：本地 Matrix 服务可用

## 灰度与回滚

- 灰度方式：无，此任务为基线采集
- 回滚方式：无代码回滚，仅需重新采样并替换错误数据
- 回滚触发条件：采集方法不一致或样本失真

## 附件

- 参考文档：`docs/baseline/performance-baseline.md`
- 截图 / trace / 日志：待补
```

### 3.2 `P0-BUNDLE-01` 建立 desktop / mobile 首轮 bundle 基线

建议标题：

```md
[P0][构建] 建立 desktop / mobile 首轮 bundle 基线
```

建议正文：

```md
## 背景

当前项目已具备 `pnpm analyze` 和 `pnpm metrics:bundle` 两类构建分析能力，但尚未形成 desktop / mobile 双端可对比的首轮 bundle 基线。现需基于 `docs/baseline/bundle-baseline.md` 建立第一版资产体积记录。

## 现状

- 当前构建主链路为 `Vite 7`
- 已存在 `pnpm build`、`pnpm analyze`、`pnpm metrics:bundle`
- `scripts/report-bundle-metrics.mjs` 已固定 `500KB` JS chunk 预警阈值
- 当前尚未沉淀最重资产和双端差异数据

## 目标

- 建立 desktop / mobile 两套真实 bundle 基线
- 识别最重 10 个资产与超过阈值的 JS 文件
- 形成首批懒加载与拆分建议

## 范围

### 包含

- desktop 构建产物采集
- mobile 构建产物采集
- `dist/bundle-metrics.json` 归档
- 可视化分析结果归档

### 不包含

- 直接实施拆包重构
- 修改功能逻辑

## 交付物

- 已填写的 `docs/baseline/bundle-baseline.md`
- `dist/bundle-metrics.json`
- 可视化分析产物
- 最重 10 个资产清单
- 超预算 JS 资产清单

## 执行步骤

1. 执行 `pnpm build`
2. 执行 `pnpm metrics:bundle`
3. 执行 `pnpm analyze`
4. 归档 desktop / mobile 两套产物分析结果
5. 填写“产物汇总”“重点 chunk 清单”“重型依赖盘点”
6. 输出首轮构建风险结论

## 验收标准

- [ ] `bundle-baseline.md` 中 desktop 产物已完成 1 次完整采集
- [ ] `bundle-baseline.md` 中 mobile 产物已完成 1 次完整采集
- [ ] 已识别最重 10 个资产
- [ ] 已识别超过阈值的 JS 资产
- [ ] 已输出首批懒加载或拆分建议

## 风险与依赖

- 风险：环境变量不一致导致产物不可比
- 风险：双端产物混填
- 依赖：构建脚本稳定可运行

## 灰度与回滚

- 灰度方式：无，此任务为基线采集
- 回滚方式：无代码回滚，必要时重新构建并重采
- 回滚触发条件：采集口径不一致或结果缺失

## 附件

- 参考文档：`docs/baseline/bundle-baseline.md`
- 构建日志 / 产物分析：待补
```

### 3.3 `P0-SEC-01` 补齐生产 CSP 基线

建议标题：

```md
[P0][安全] 补齐生产 CSP 基线
```

建议正文：

```md
## 背景

当前 Tauri 配置中的 `app.security.csp` 仍为 `null`，桌面端和移动端尚未具备显式的生产 CSP 白名单。现需基于 `docs/baseline/security-baseline.md` 产出首版生产 CSP 基线，并完成关键路径回归。

## 现状

- `src-tauri/tauri.macos.conf.json` 中 `csp` 为 `null`
- `src-tauri/tauri.windows.conf.json` 中 `csp` 为 `null`
- 当前缺少统一的 `script-src`、`connect-src`、`img-src`、`media-src`、`style-src` 策略

## 目标

- 为生产构建提供显式 CSP 白名单
- 确保登录、OIDC、媒体、外链、更新等关键路径不被错误拦截
- 建立 CSP 变更后的回归与回滚流程

## 范围

### 包含

- 桌面端 CSP 草案
- 移动端 CSP 草案
- 关键交互回归验证
- 文档化记录

### 不包含

- 全量前端安全改造
- 所有 capability 收敛

## 交付物

- 更新后的 Tauri 配置
- CSP 策略文档
- 回归结果记录
- 风险说明与回滚手册

## 执行步骤

1. 根据现有请求域和资源类型起草 CSP 白名单
2. 在桌面端与移动端配置中接入 CSP
3. 回归登录、OIDC、媒体、更新、外链路径
4. 记录被拦截资源和必要放行项
5. 更新安全基线文档

## 验收标准

- [ ] 生产配置不再为 `csp: null`
- [ ] 已形成可审查的 CSP 白名单
- [ ] 关键流程回归通过
- [ ] 已有回滚说明

## 风险与依赖

- 风险：策略过严导致登录或媒体失败
- 风险：策略过宽导致安全收益不足
- 依赖：需梳理实际资源来源

## 灰度与回滚

- 灰度方式：先在预发或内部包验证，再进入正式构建
- 回滚方式：恢复到上一版配置并重新打包
- 回滚触发条件：登录、OIDC、媒体、更新任一关键链路阻断

## 附件

- 参考文档：`docs/baseline/security-baseline.md`
- 配置 diff / 拦截日志：待补
```

### 3.4 `P0-SEC-02` 收敛移动端 capability

建议标题：

```md
[P0][安全] 收敛移动端 capability
```

建议正文：

```md
## 背景

当前移动端 capability 权限范围偏大，包括 `fs:**`、`http://**`、`https://**` 以及 `hula:default allow *`。需要基于最小权限原则完成权限面收敛，并形成 capability-to-feature 映射。

## 现状

- `mobile-capability` 中 `fs` 路径为 `**`
- `http` 白名单当前为全量放开
- 自定义 `hula:default` scope 为 `allow: ["*"]`
- 现阶段缺少“功能 -> 权限”映射表

## 目标

- 缩小移动端高风险权限面
- 明确每项 capability 的真实业务用途
- 降低误授权和后续安全审计成本

## 范围

### 包含

- 移动端 capability 梳理
- capability-to-feature 映射表
- 高风险权限收敛

### 不包含

- 桌面端 capability 全量收敛
- 业务功能重构

## 交付物

- 更新后的 `mobile-capability`
- capability-to-feature 映射表
- 回归测试记录

## 执行步骤

1. 枚举移动端现有 capability
2. 按功能归类每项权限的使用方
3. 删除或缩小无必要授权
4. 回归扫码、通知、录音、文件读写等路径
5. 归档权限收敛结论

## 验收标准

- [ ] 不再保留无说明的全量 `fs` 授权
- [ ] 不再保留无说明的全量 `http/https` 授权
- [ ] `hula:default allow *` 已替换为明确 scope
- [ ] capability-to-feature 映射表已归档

## 风险与依赖

- 风险：权限缩小后导致移动端部分功能失效
- 依赖：需要前端、移动端、Rust 共同确认调用链

## 灰度与回滚

- 灰度方式：先在内部测试包验证核心路径
- 回滚方式：恢复上一版 capability 配置
- 回滚触发条件：扫码、通知、文件、录音等关键功能异常

## 附件

- 参考文档：`docs/baseline/security-baseline.md`
- capability diff / 回归记录：待补
```

### 3.5 `P0-SEC-03` 明确 token 存储加密方案

建议标题：

```md
[P0][安全] 明确 token 存储加密方案
```

建议正文：

```md
## 背景

当前可见代码显示，前端通过 Tauri 命令持久化 token，Rust 侧会将 token / refresh token 写入本地 SQLite 用户表。现需梳理现状并产出正式的 token 存储加密与迁移方案。

## 现状

- 前端通过 `update_token` / `get_user_tokens` / `remove_tokens` 访问 token
- Rust 仓储层当前会保存 `im_user.token` 与 `im_user.refresh_token`
- 当前文档中尚无系统安全存储或字段加密的落地方案

## 目标

- 明确 token 当前存储路径、读取路径和风险面
- 评估系统安全存储或本地加密方案
- 输出迁移步骤、兼容策略和回滚方案

## 范围

### 包含

- 现状梳理
- 风险分析
- 方案设计
- 迁移路径设计

### 不包含

- 一次性完成全部代码重构
- 变更服务端认证协议

## 交付物

- token 存储现状说明
- 候选方案对比表
- 推荐方案 ADR 或专题文档
- 迁移与回滚计划

## 执行步骤

1. 梳理前端与 Rust 侧 token 读写链路
2. 明确 SQLite、本地内存、浏览器存储中的实际落点
3. 对比系统安全存储、本地加密、兼容迁移方案
4. 输出正式推荐方案
5. 定义发布阻塞条件与迁移计划

## 验收标准

- [ ] 已输出正式方案文档
- [ ] 已明确迁移步骤
- [ ] 已明确回滚说明
- [ ] 已明确发布阻塞条件

## 风险与依赖

- 风险：迁移方案影响现有自动登录和登录恢复
- 风险：多端兼容路径复杂
- 依赖：需要 Rust、前端、QA 联合评审

## 灰度与回滚

- 灰度方式：先保留兼容读取，再切换默认写入
- 回滚方式：恢复旧写入路径并保留兼容读取
- 回滚触发条件：登录恢复失败率显著上升或 token 丢失

## 附件

- 参考文档：`docs/baseline/security-baseline.md`
- 链路图 / 方案评审记录：待补
```

---

## 4. 后续补充建议

- 下一批可继续补 `P0-PERF-02`、`P0-BUNDLE-02`、`P1-SEC-01`
- 如果后续接入 GitHub Issue Forms，可把本文件结构转换成 YAML 表单
- 如果使用 GitHub Projects，可直接以 `ID / 领域 / 优先级 / 状态 / 目标版本` 建字段
