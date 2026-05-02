# [P1][安全] 建立依赖审计周期任务

## 背景

前端依赖（npm）和 Rust 依赖（Cargo）存在供应链攻击风险。由于项目依赖库较多，且更新频繁，需要建立自动化的审计机制，确保已知的安全漏洞（CVE）能被及时发现并修复。

## 现状

- 当前行为：仅在开发者手动更新时偶尔运行 `pnpm audit`。
- 已知风险：过期的、含有高危漏洞的子依赖长期驻留在项目中。
- 影响范围：构建环境与运行环境。

## 目标

- 目标 1：将依赖审计集成至 CI 工作流。
- 目标 2：规定漏洞修复的时限（如 Critical 漏洞 48 小时内处理）。
- 目标 3：建立依赖更新的审批流程（ADR）。

## 范围

### 包含

- `package.json` (npm) 依赖审计。
- `Cargo.toml` (Rust) 依赖审计。
- Tauri 核心组件漏洞跟踪。

### 不包含

- 运行时动态加载的外部脚本审计（通过 CSP 处理）。

## 交付物

- 代码：GitHub Actions / GitLab CI 审计脚本。
- 文档：依赖安全治理规范。
- 文档：历史漏洞修复记录（存入 `docs/security/audits/`）。

## 执行步骤

1. 配置 `pnpm audit --audit-level high` 作为 CI 阻塞条件。
2. 引入 `cargo-audit` 扫描 Rust 侧漏洞。
3. 设定每周一自动触发全量依赖扫描报告。
4. 对无法立即修复的漏洞（上游未更新）建立“豁免申请单”。

## 验收标准

- [ ] CI 流水线能够识别并拦截包含 High/Critical 漏洞的提交。
- [ ] 形成可追溯的审计周报或看板。
- [ ] 关键依赖（如 `tauri`, `matrix-js-sdk`）版本保持在最近 3 个月内。

## 风险与依赖

- 风险：审计工具可能产生误报，需要人工核实。
- 依赖：无。

## 灰度与回滚

- 灰度方式：先作为 Non-blocking 任务运行，观察两周后转为 Blocking。
- 回滚方式：在 CI 配置中注释掉审计步骤。

## 附件

- 参考工具：[pnpm audit](https://pnpm.io/cli/audit), [cargo-audit](https://github.com/RustSec/rustsec/tree/main/cargo-audit)
