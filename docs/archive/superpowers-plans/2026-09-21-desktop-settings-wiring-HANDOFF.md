# 交接：桌面设置接线治理（SDD 执行中）

> **给下一个 agent：** 本文件是续接点。真正的进度记录在
> `.superpowers/sdd/2026-09-21-desktop-settings-wiring/progress.md`（ledger，**先读它**），
> 需求在 `docs/superpowers/plans/2026-09-21-desktop-settings-wiring.md`（16 个任务，0..15）。
> 用 `superpowers:subagent-driven-development` 继续：每个任务派新实现者 subagent，
> 跑「评审 → 修复轮 → 范围化重审」循环。

## 当前状态

- worktree：`.worktrees/settings-wiring`，分支 `feat/settings-wiring`，基点 `e157675a`
- 已完成 **7 个任务**（Task 0..5 + Task 2b），**14 个提交**，全部通过评审
- 最近提交：`7cc32fa4`（Task 2b 修复轮 2）
- 守门计数：死配置基线 **34**（判据修正后的诚实值，见下）
- 全量测试：`npx vitest run` **9066 通过**

### 已完成的关键修复
- Task 2b：未读角标**真的**修好了。两条路径都有真实测试：
  in-session（`setLastRead` 接线）与 cross-restart（`persist: { pick: ['lastReadActiveTimeStore'] }`
  + 冷启动 bootstrap 不再清 `sessionUnread` 账本）。
  期间发现我自己的第一次修复**只在一个重启内有效**——`SessionBootstrapService.ts:153`
  每次冷启动都调 `clearUserLocalStorage()`，而它清 `sessionUnread`。

## 下一步：Task 6

`## Task 6: 通知/线程/空间细粒度开关接线（P1，9 个 key）`

**先读方案顶部新增的「执行中修正」一节**——Task 6 的关键前提已在那里说明：
必须先引入**统一决策门** `shouldNotify(...)` 并让 Task 5 的发送路径调用它
（替换裸的 `atUidList` 判断），否则那 9 个开关又是"存了不生效"；
且必须选定唯一偏好来源（store 或 `config.events`，不要两边都写），
关键词不要造第三份（`notificationDisplayPreferences.ts` 已有实现）。

流程（每个任务都一样）：

```bash
SKILL=/Users/ljf/.agents/skills/subagent-driven-development
PLAN=docs/superpowers/plans/2026-09-21-desktop-settings-wiring.md
"$SKILL/scripts/task-brief" "$PLAN" 6      # 产出 task-6-brief.md，路径给实现者
cd .worktrees/settings-wiring && git rev-parse HEAD   # 记 BASE
```

派实现者时**只给**：一句任务定位 + brief 路径 + 前序任务的接口 + 我对歧义的裁决 +
报告文件路径。不要把整个 plan 给它，也不要粘贴历史进度。

实现者回来后：生成 diff 文件 → 派 task reviewer（给它 brief、report、diff 三个路径 +
本任务的 Global Constraints）→ 有 Critical/Important 就进修复轮（最多 5 轮）→
审查干净后往 ledger 追加 `Task N: complete`。

## 必须遵守的环境约束

- worktree 的 `node_modules` 是**指向主树的软链**。主树并行跑 `pnpm install` 会让本 worktree
  的测试中途崩（TS2307、vitest worker 启不来、静默挂起）。遇到就等一会儿重试，**不要**在这里
  跑 `pnpm install`。
- 测试用 `npx vitest run <path>`，**不要**用 `pnpm test:run`（软链导致 `ERR_PNPM_IGNORED_BUILDS`）。
- pre-commit 钩子跑 `lint-staged && vue-tsc --noEmit`，约 140s。`git commit` 要放后台/长超时。
- 不使用 `--no-verify`；不 `git reset` 主树里并行会话的改动。
- 主工作树有并行会话的未提交改动，**不要**在主树 `git add -A`。
- worktree 路径与主树路径不同：`review-package` 脚本要在**主树**跑会让 BASE/HEAD 解析错，
  所以 diff 用 `git -C .worktrees/settings-wiring diff -U10 BASE..HEAD` 手写到
  `.superpowers/sdd/2026-09-21-desktop-settings-wiring/` 下的唯一文件名。

## 执行中暴露的方法论（比修 bug 更重要，别丢）

1. **守门有结构性盲区**：`check-settings-wiring.mjs` 只测设置窗口里的 `localStorage.setItem`。
   值一旦搬进 store/service，**"有字段但没有消费方"对它完全隐形**。Task 2/3/5 全属这一类。
   所以每个任务都要问一句：**这个开关从用户操作到实际效果，链路真的通吗？**
2. **我的首版审计漏了 `const STORAGE_KEY` 别名形态**（Task 0 评审发现），28 个死 key 里漏了 3 个。
   写检测脚本时，**先用真实 Vite/SFC 编译或解析器验证**，不要只靠字符串匹配——
   字符串匹配还产生过 `SpaceTree` 被 `SkeletonSpaceTree` 命中的误报。
3. **评审也会不严谨**：Task 3 评审给的复现序列在修复前其实是绿的（开分支会清掉旧门闩），
   实现者用 A/B 实测纠正了它。实现者要自己验证复现，不要照抄评审的话。
4. **文档/注释写错比没写更糟**：`NotificationSettings.vue:181` 那句"showNotification() 消费这份配置"
   是假的，它误导了整条排查路线（Task 4→5）。

## 已知待办（不要重复发现）

### 来自 Task 5 评审，需在最终评审分诊
- **（Important，非 Task 5 引入的回归）** 通知配置是内存快照：**开关前就已打开的独立聊天窗口**
  在用户关闭通知后仍会弹。独立聊天窗口属于 Matrix 窗口（`windowLabels` 只排除
  capture/tray/notify/update），各自有单例与 `pushMsg`。
  候选修法：`getConfig()` 改为回读已持久化的 localStorage，或监听 `storage` 事件刷新。
- Minor：`showSender=false` 仍带发送者头像（实际无效：`mxc://` 无法作为 OS 图标路径渲染；
  且 brief 要求保留 `icon`）——属需求层张力，需产品裁决；
  测试里 `not.toContain('Alice')` 大小写敏感、断言力偏弱；
  `lastSentOptions` 读的是 `calls[0]` 不是最后一次；
  `[*]`/`[•]` 原始标记会原样进原生通知标题；
  桌面写 `tjg-keywords` 而服务读 `tjg-notification-display-preferences`（桌面/移动展示偏好不统一）。

### 来自 Task 3 评审
- 自我视角的状态标签在"开关关闭"时可能仍显示"在线"（对端看到的是离线）；
- 关闭开关后有 ≤45s 窗口才降级；
- 开关关闭时登录会重复发一次 `offline` PUT；
- 移动端 `mobile/views/my/StatusSettings.vue:103` 仍未接入（该开关移动端无 UI，默认 true，暂无泄漏）。

### 来自 Task 2 评审
- `MatrixNotificationService.sendReceiptForce` 是真实绕过但**当前不可达**
  （`ackNotificationWithFallback` 零调用方）；
- `usePresenceHeartbeat` 在开关关闭时仍跑 45s 空转定时器（修复它需要偏好变更订阅，
  贸然停掉会导致重新打开开关后心跳起不来——已判定跳过）。

### 计划里的既定顺序
Task 6 通知细粒度 → 7 勿扰时段 → 8 屏蔽用户统一（删 `InviteListsSection`，
用户已批准删除）→ 9 别名键 → 10 字体缩放 → 11 气泡+devtools → 12 备份状态 →
13 音视频（音质经 `applyConstraints`；设备切换需 `replaceTrack`，已注明不在本次）→
14 契约守门 → 15 收尾（全量门禁 + 合并 master）。

## 绝对不要做

- 不要把死配置数量写死进新文档——以 `check-settings-wiring.mjs` 的实测为准
  （判据修正后为 34，此前 22/28 都是过时或不准确的数）。
- **不要用"计数下降"当完成判据**：搬走写入会让计数下降但功能照样不生效。
  验收必须是**行为测试**（Task 2/3/5/2b 都是这么做的）。
- 不要为了让测试变绿而放宽守卫或删除断言（评审明确禁止）。
- 不要把一个"永远不生效的开关"留在代码里：接不上消费方就按 YAGNI 删 UI 并在提交信息里写明依据。
- 不要在最终评审前声称整体完成——只剩局部任务完成。
