# [P0][安全] 收敛移动端 capability

> Task ID：`P0-SEC-02`  
> 优先级：`P0`  
> 建议负责人：安全负责人 / Rust 负责人 / 前端负责人  
> 目标版本：待填写  
> 计划周期：第 1 周  
> 关联文档：[`security-baseline.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/baseline/security-baseline.md) / [`issue-backlog.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/issue-backlog.md)

## 背景

当前移动端 capability 权限范围偏大，包括 `fs:**`、`http://**`、`https://**` 以及 `hula:default allow *`。需要基于最小权限原则完成权限面收敛，并形成 capability-to-feature 映射。

## 现状

- 当前行为：`mobile.json` 中 `fs` (read/write/mkdir) 的路径全部放开为 `**`；且包含 `powershell` 和 `cmd` 的 `shell:allow-execute` 配置。
- 已知风险：1. 恶意脚本可遍历并修改手机全盘文件；2. 移动端存在桌面端 Shell 配置，可能导致异常注入。
- 影响范围：iOS / Android 移动端。

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

1. 枚举移动端现有 capability。
2. 按功能归类每项权限的使用方。
3. 删除或缩小无必要授权。
4. 回归扫码、通知、录音、文件读写等路径。
5. 归档权限收敛结论。

## 验收标准

- [ ] 不再保留无说明的全量 `fs` 授权
- [ ] 不再保留无说明的全量 `http/https` 授权
- [ ] `hula:default allow *` 已替换为明确 scope
- [ ] capability-to-feature 映射表已归档

## 测试与验证

- 本地验证：移动端关键路径回归
- 人工验证：扫码、通知、录音、文件读写逐项记录
- CI 验证：如有，补 workflow 链接

## 风险与依赖

- 风险：权限缩小后导致移动端部分功能失效
- 依赖：需要前端、移动端、Rust 共同确认调用链

## 灰度与回滚

- 灰度方式：先在内部测试包验证核心路径
- 回滚方式：恢复上一版 capability 配置
- 回滚触发条件：扫码、通知、文件、录音等关键功能异常

## 待补字段

- Issue 编号：待填写
- Owner：待填写
- Reviewer：待填写
- QA：待填写
- 起止时间：待填写
