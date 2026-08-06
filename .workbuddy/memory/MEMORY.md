# 项目长期记忆 — Tjg (HuLa IM)

## 项目约定
- commitlint scope-enum 限定：core/ui/chat/mobile/plugin/hook/service/util/i18n/config/ci/test/tauri。**管理后台相关提交用 `ui` scope**（`admin` 不在允许列表）
- 设计 token 体系：`--tjg-*` 为规范前缀，`--color-*`/`--bg-*` 为旧别名（已于 2.6.3 全部迁移完毕，.vue 文件残留 0 条）
- 图标方案：SVG Sprite（`public/icon.js`，184 symbol，156 文件引用）+ Iconify（`@iconify/vue`，70 文件）双轨共存，不一刀切迁移；新界面默认用 Iconify，不再扩充 Sprite
- 内联 SVG 治理样板：`src/views/admin/icons/`（adminNavIcons.ts 路径表 + AdminNavIcon.vue 组件）
- TDD 验收基线：vue-tsc --noEmit (0 errors) + vitest run (全绿) + biome check (clean)

## 技术栈要点
- 前端：Vue 3 Composition API + `<script setup lang="ts">` + Naive UI + UnoCSS + Pinia + vue-i18n
- 后端：Tauri v2 + Rust + SQLite (SeaORM) + Matrix 协议 (synapse-rust + matrix-js-sdk)
- Matrix SDK 运行在 Web Worker (`src/workers/matrixSdk.worker.ts`)，主线程 <50ms 约束
- 管理后台服务层：`adminService` facade 委托子服务，组件不直连 SDK

## 无障碍
- `prefers-contrast: more` 媒体查询已落地于 `src/styles/css/design-tokens.css`（浅色/暗色分别覆盖）
- a11y 测试：`e2e/a11y-baseline.spec.ts`（axe-core，grep `@a11y`）
- **已知对比度违规**（见 docs/原型对齐优化方案-2026-08-05.md Task 1/2，待修）：暗色 `--tjg-text-tertiary #707070` 3.65:1、`--tjg-text-quaternary #595959` 最低 1.8:1、发送气泡 `#13987f` 白字 ~2.6:1，均不达 AA 4.5:1

## 技能库（~/.workbuddy/skills/，2026-08-05 安装）
- 前缀约定：`sp-`=Superpowers（14）、`mp-`=MattPocock（37）、`gs-`=gstack（54），共 105 个
- gstack 的 setup 脚本不可运行（会写 ~/.codex 等其他工具目录）；其 /qa、/browse 技能依赖自带浏览器二进制，WorkBuddy 环境不可用
- 新装技能需重启会话才被 Skill 工具识别；急用可直接 Read 对应 SKILL.md 执行
- 关键计划文档：`docs/原型对齐优化方案-2026-08-05.md`（TJG-prototype.html 四维度对齐，12 Task，21T）
