# Tasks

- [x] Task 1: 梳理并统一 OpenClaw 桌面入口
  - [x] SubTask 1.1: 盘点 `robot` 与 `openclaw` 双入口、左侧插件文案、桌面路由和默认落地页
  - [x] SubTask 1.2: 明确统一后的主入口方案，约束旧入口为复用或重定向，不再并行维护两套主界面
  - [x] SubTask 1.3: 对齐入口命名、空态文案和导航语义，确保用户从当前 chatbot 入口直接进入 OpenClaw 工作台

- [x] Task 2: 将当前 chatbot 界面重构为 OpenClaw 专属工作台 UI
  - [x] SubTask 2.1: 参考 `openclaw-UI--Chinese` 提炼可落地的布局骨架、欢迎态、消息区、输入区和状态区
  - [x] SubTask 2.2: 结合 HuLa 现有主题变量、UnoCSS、暗色模式和桌面布局风格完成视觉收敛
  - [x] SubTask 2.3: 替换旧 chatbot 默认视图，使 OpenClaw 工作台成为用户可见的唯一桌面 AI 主界面

- [x] Task 3: 补齐 OpenClaw 工作台交互与功能闭环
  - [x] SubTask 3.1: 整合连接检测、模型选择、消息发送、流式响应、失败提示和重试反馈
  - [x] SubTask 3.2: 统一欢迎态、空会话态、连接失败态、处理中状态和成功状态的页面反馈
  - [x] SubTask 3.3: 清理旧 robot 视图与轻量 OpenClaw 页的重复逻辑，统一复用到单一工作台链路

- [x] Task 4: 新增 OpenClaw 桌面端安装检测与 platform 提示
  - [x] SubTask 4.1: 基于现有平台检测能力定义 OpenClaw 已安装/未安装/不可检测的状态模型
  - [x] SubTask 4.2: 在桌面端新增 Tauri 命令，用于检测 OpenClaw 是否已安装，并返回平台化结果
  - [x] SubTask 4.3: 在界面中按 `windows` / `macos` / `linux` 展示清晰的安装说明、失败提示与手动安装兜底方案

- [x] Task 5: 打通“一键安装 OpenClaw”能力
  - [x] SubTask 5.1: 设计前端按钮状态机，包括可安装、安装中、安装成功、安装失败和重试
  - [x] SubTask 5.2: 在桌面端实现 OpenClaw 自动安装命令链路，处理权限、网络与结果回传
  - [x] SubTask 5.3: 安装完成后自动刷新安装状态，并引导用户连接或启动 OpenClaw

- [x] Task 6: 完成验证与回归
  - [x] SubTask 6.1: 验证当前 chatbot 入口、旧 OpenClaw 入口和统一工作台之间的导航行为一致
  - [x] SubTask 6.2: 验证 OpenClaw 已安装、未安装、安装失败、连接成功、连接失败等关键场景
  - [x] SubTask 6.3: 运行与本次修改相关的类型检查、界面回归和必要测试，沉淀验证结果

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 2]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 3, Task 5]

# Parallelizable Work

- Task 2 与 Task 4 可在入口方案确定后并行推进
- Task 3 与 Task 5 可分别在 UI 主体和安装能力基础上并行联调

# Progress Notes

- 已完成统一入口、OpenClaw 工作台 UI、连接/流式响应、安装检测与一键安装链路。
- 已新增 `src/services/openclaw/__tests__/OpenClawService.test.ts`，覆盖连接失败判定与停止生成行为。
- 已运行 `pnpm vitest run src/services/openclaw/__tests__/OpenClawService.test.ts` 并通过。
- 已运行 `pnpm exec vue-tsc --noEmit`，确认 OpenClaw 相关文件无新增类型错误。
- 已将左侧插件入口文案国际化。
