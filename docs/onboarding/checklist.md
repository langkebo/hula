# hula Onboarding Checklist

> 版本：v1.0.0  
> 维护人：项目维护者 / 前端负责人  
> 最后更新：2026-04-30

---

## 1. 目标

用于帮助新成员在 1 个工作日内完成 `hula` 本地环境准备、项目理解、常用命令掌握与首个改动提交流程。

---

## 2. 环境准备

### 2.1 基础工具

- [ ] 安装 Node.js（与项目要求版本一致）
- [ ] 安装 PNPM
- [ ] 安装 Rust / Cargo
- [ ] 安装 Tauri 开发依赖
- [ ] 安装 Git、IDE、推荐插件

### 2.2 平台依赖

- [ ] macOS 开发依赖已安装
- [ ] Windows 开发依赖已安装（如适用）
- [ ] Android / iOS 开发依赖已安装（如适用）

---

## 3. 获取代码

- [ ] 克隆 `hula` 仓库
- [ ] 检查 `matrix-js-sdk` 本地链接依赖是否可用
- [ ] 安装依赖：`pnpm install`
- [ ] 确认安装阶段无阻塞错误

---

## 4. 启动项目

### 4.1 Web / 前端调试

- [ ] 运行：`pnpm dev`
- [ ] 确认页面可正常打开

### 4.2 桌面端调试

- [ ] 运行：`pnpm tauri:dev`
- [ ] 确认桌面窗口正常启动

### 4.3 测试命令

- [ ] 运行：`pnpm test:run`
- [ ] 运行：`pnpm test:e2e`
- [ ] 运行：`pnpm check`

---

## 5. 代码结构理解

建议优先了解以下目录：

- [ ] `src/services/matrix/`
- [ ] `src/stores/`
- [ ] `src/hooks/`
- [ ] `src/components/`
- [ ] `src/views/`
- [ ] `src/services/backend/`
- [ ] `src-tauri/`

建议优先阅读以下文档：

- [ ] [`hula优化实施方案.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/hula优化实施方案.md)
- [ ] [`PROJECT_OPTIMIZATION_ROADMAP.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/PROJECT_OPTIMIZATION_ROADMAP.md)
- [ ] [`RoomArchitecture.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/RoomArchitecture.md)
- [ ] [`SDK_API_AUDIT_REPORT.md`](file:///Users/ljf/Desktop/hu_ts/hula/docs/SDK_API_AUDIT_REPORT.md)

---

## 6. 日常开发流程

- [ ] 从任务系统领取 Issue
- [ ] 阅读关联 ADR / 方案文档
- [ ] 建立本地分支
- [ ] 完成开发
- [ ] 补充或更新测试
- [ ] 运行检查命令
- [ ] 提交 PR

推荐提交前自检命令：

```bash
pnpm check
pnpm test:run
pnpm test:e2e
```

---

## 7. 调试与排障

- [ ] 会查看浏览器控制台与网络请求
- [ ] 会查看 Tauri / Rust 日志
- [ ] 会使用 Vitest 定位回归
- [ ] 会使用 Playwright 复现关键链路问题
- [ ] 会查看 Sentry / 性能指标（如已接入）

---

## 8. 安全与质量要求

- [ ] 不在日志中输出 token、恢复密钥、敏感个人信息
- [ ] 不扩大 capability / 权限范围而无评审
- [ ] 不新增未说明用途的重型依赖
- [ ] P0 级架构改动需补 ADR
- [ ] 优化类改动需提供基线对比或说明原因

---

## 9. 首个任务建议

建议新成员从以下类型任务开始：

- [ ] 文档修正
- [ ] 测试补齐
- [ ] 轻量 UI 一致性修复
- [ ] 非核心模块懒加载改造
- [ ] 基线数据补录

---

## 10. 入项验收

满足以下条件视为完成 Onboarding：

- [ ] 能独立启动 Web 与桌面端
- [ ] 能运行测试与检查命令
- [ ] 能说明主要目录职责
- [ ] 能完成一个小型 PR
- [ ] 能理解当前优化方案和优先级

---

## 11. 反馈记录

| 日期 | 新成员 | 遇到的问题 | 处理结果 |
|---|---|---|---|
| 待填写 | 待填写 | 待填写 | 待填写 |
