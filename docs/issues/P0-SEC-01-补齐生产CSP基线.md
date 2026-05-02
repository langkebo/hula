# [P0][安全] 补齐生产 CSP 基线

> Task ID：`P0-SEC-01`  
> 优先级：`P0`  
> 建议负责人：安全负责人 / 前端负责人  
> 目标版本：待填写  
> 计划周期：第 1 周  
> 关联文档：[`security-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) / [`issue-backlog.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-backlog.md)

## 背景

当前 Tauri 配置中的 `app.security.csp` 仍为 `null`，桌面端和移动端尚未具备显式的生产 CSP 白名单。现需基于 `docs/baseline/security-baseline.md` 产出首版生产 CSP 基线，并完成关键路径回归。

## 现状

- 当前行为：`tauri.conf.json` 中的 CSP 配置包含 `'unsafe-inline'` 和 `'unsafe-eval'`，且 `connect-src` 放开了全量 http/https 访问。
- 已知风险：1. 攻击者可利用内联脚本注入执行恶意代码；2. 无法有效防止数据外泄至未经授权的域名。
- 影响范围：全端（Desktop / Mobile）。

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

1. 根据现有请求域和资源类型起草 CSP 白名单。
2. 在桌面端与移动端配置中接入 CSP。
3. 回归登录、OIDC、媒体、更新、外链路径。
4. 记录被拦截资源和必要放行项。
5. 更新安全基线文档。

## 验收标准

- [ ] 生产配置不再为 `csp: null`
- [ ] 已形成可审查的 CSP 白名单
- [ ] 关键流程回归通过
- [ ] 已有回滚说明

## 测试与验证

- 本地验证：关键登录与媒体链路手工回归
- 人工验证：记录被拦截资源与必要放行项
- CI 验证：如有，补 workflow 链接

## 风险与依赖

- 风险：策略过严导致登录或媒体失败
- 风险：策略过宽导致安全收益不足
- 依赖：需梳理实际资源来源

## 灰度与回滚

- 灰度方式：先在预发或内部包验证，再进入正式构建
- 回滚方式：恢复到上一版配置并重新打包
- 回滚触发条件：登录、OIDC、媒体、更新任一关键链路阻断

## 待补字段

- Issue 编号：待填写
- Owner：待填写
- Reviewer：待填写
- QA：待填写
- 起止时间：待填写
