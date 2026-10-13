# 提交纪律（并行写者场景）

本仓由多人/多会话并行修改（实测同一工作区常有 5–10 个未提交脏文件，且他人会在你操作期间提交）。
以下纪律来自**实测踩坑**，不是理论建议。

---

## 1. 提交必须用显式 pathspec

```bash
git add -- <我的文件A> <我的文件B>
git diff --cached --name-only            # 核对：应恰好是我的文件，且数量符合预期
git commit -F /tmp/msg.txt -- <我的文件A> <我的文件B>
```

- `git commit -F msg -- <paths>` 里的 pathspec 才是「只提交这些」的正解；
  **`git add -- <我的>` + 裸 `git commit` 不行** —— 别人**已暂存**（`git status` 第 1 列有 `M`）的改动会被一并收走。
- 提交前务必核对 `git diff --cached --name-only`，并**带基数断言**（如 `[ "$(wc -l < list)" -eq 7 ]`）。
- 提交后再核对一次：`git show --pretty="" --name-only HEAD` 应恰好是本批文件。

> **实测**：一次提交把 `meta/ratchet-baseline.json`、`package.json` 等他人改动卷了进来；
> 另一次别人的提交把我在盘的 `package.json` 编辑**收走了**，导致 HEAD 一度出现
> 「脚本定义已在、脚本文件未跟踪」的悬空引用。两者都靠上面三步核对才能当场发现。

## 2. `HEAD` 竞争：`cannot lock ref 'HEAD'`

并行写者在你的 `git commit` 执行期间推进了 HEAD 时会看到：

```
fatal: cannot lock ref 'HEAD': is at <新> but expected <旧>
```

- **索引不受损**，工作区也不受影响；
- 处理方式：`git rev-parse --short HEAD` 确认新基线 → 需要时**重测会被影响的数字/结论** → 原样重试提交；
- 不要用 `--no-verify`、不要 `reset --hard`。

## 3. 钩子很慢，一律后台跑

- `pre-commit` = `lint-staged && vue-tsc --noEmit`（全工作区类型检查），实测 1.5–12 分钟；
  前台跑可能被 SIGTERM（exit 137）。
- 被杀的提交会留下 `.git/index.lock`；**只清理自己那个 pid** 留下的锁。
- 跑钩子期间**不要编辑 `src/**`**（Rust / JSON / 文档不受影响）。

## 4. commitlint 约束

- `type` 必须是：`feat|fix|docs|style|refactor|perf|test|build|ci|revert|chore`；
- **`scope` 白名单**（不在其中会被拒）：
  `core | ui | chat | mobile | plugin | hook | service | util | i18n | config | ci | test | tauri`
  —— 注意**没有** `docs` / `sdk`；文档与 SDK 集成相关改动用 `docs(service):`；
- `header` 最长 100 字符。

## 5. 门禁与小棘轮

- 提交前建议本地先跑受影响的门禁；发布前跑 `pnpm check:release`（20+ 段，含全工作区 `vue-tsc`）。
- `pnpm check:file-size` 是**只许缩**的棘轮（`meta/file-size-baseline.json`，阈值 400/红线 800）：
  受管文件不得增长，绝不 `--update` 抬基线；需要加逻辑就抽到新文件。
- 新增守卫必须：① 接入 `check:release`；② 带**基数断言**（扫不到东西 ⇒ EXIT=2，不当作通过）；
  ③ 配 `tests/lint/*.test.ts` 单测 + 变异自证（注入缺陷 ⇒ 判红 ⇒ 逐字节还原）。

## 6. 既有失败（别浪费时间）

- `src/services/matrix/__tests__/MatrixCryptoStateTracker.test.ts` 的 H1 两条用例会 30s 超时并污染下一条
  （已用 HEAD 版源码 A/B 复现，与本轮改动无关）。
