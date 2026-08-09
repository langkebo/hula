# 调试构建日志分析 + 登录页白屏修复

## 日志结论：本轮日志显示应用实际已跑通
- 启动 → 登录窗口渲染（FCP 21ms）→ 自动密码登录 `matrix.test` 返回 403 → 经存储 token 恢复 → 主窗口加载、Rust Crypto 初始化、sync PREPARED、presence online。**即上一轮"登录页白屏"已被先前的 `events` CJS 兜底修复消除**。
- 唯一残留报错：`Importing a module script failed.`（14:48:16），由 Vite 运行时重新预构建触发。

## 问题分级
| 级别 | 现象 | 性质 | 处理 |
| :--- | :--- | :--- | :--- |
| 噪音 | `IMKCFRunLoopWakeUpReliable` / `TSM AdjustCapsLockLED` | macOS 输入法系统消息 | 忽略 |
| 良性 | 启动自动密码登录 → 403 M_FORBIDDEN | 开发态凭据噪声，随后 token 恢复 | 可观察，非 bug |
| **真实隐患** | `Importing a module script failed` + Vite "optimized dependencies changed. reloading" | `@tauri-apps/api/webview` 迟到发现→重优化+reload 竞态；**生产无 reload 兜底会致命白屏** | 已修复 |

## 根因与修复
- **根因**：`@tauri-apps/api/webview` 是 `webviewWindow` 的传递依赖，Vite 初始依赖扫描漏抓，运行时才发现 → 强制重优化 + 整页 reload → reload 竞态里浏览器导入新 module script 失败。
- **修复**（`build/config/vite.config.base.ts`，commit `cb769bbe`）：`optimizeDeps.include` 增补全部 `@tauri-apps/api/*` 子路径（webviewWindow/webview/core/event/path/window/app/dpi/tray），外加此前已补的 `events` + SDK CJS 依赖（loglevel/content-type/matrix-events-sdk/matrix-widget-api/sdp-transform）。`matrix-js-sdk` 仍 `exclude`（保持 alias 从源码编译）。

## 验证
- `vite --force` 干净 dev server + Playwright 探针加载 `/login`：app innerHTML = 17673（表单完整渲染）、`Importing a module script failed` = 0、Vite 日志无 webview 迟到发现 / 无 reloading。
- `pnpm commit` 钩子全量 vue-tsc + biome 通过。

## 备注
- 提交前曾因 pre-commit 钩子全量 vue-tsc 触发 SIGKILL（疑似内存压力，后台 dev server 占满），杀掉后台 server 后重试提交成功。
- 工作树残留 `src/typings/auto-imports.d.ts`、`i18n.d.ts` 为 dev server 重新生成的漂移产物（前者是工具版本噪音去头，后者补齐了已提交 JSON 中滞后 4 个 `space.*` key），已 `git checkout` 还原，未混入本提交。
