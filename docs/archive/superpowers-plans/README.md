# superpowers 历史计划归档（2026-08 ~ 2026-10）

> **本目录是历史存档，不是现状依据。** 这里的计划都是**一次性实施计划**（`superpowers`
> 工作流产出），对应的工作早已执行完毕；部分计划引用的代码/服务此后已被删除或收敛。

## 为什么被移到这里

`docs/superpowers/plans/` 中是 `superpowers:subagent-driven-development` /
`writing-plans` 工作流的产物。原目录混放了**历史计划**与**新计划**，导致读代码的人容易
把 2026-08 的计划当成现状。

2026-10-14 按 `OPS_ARTIFACTS/DOC_REDUNDANCY_SCAN_2026-10-13.md` 的处理口径
（「能改对的直接改；历史文档留档 + 标明过期」）做了一次**移动**（`git mv`，历史可回溯），
把 26 份历史计划移入本目录；`docs/superpowers/plans/` 只保留**当前活跃**的计划。

- 判据：文件创建日期 + 是否仍有引用 + 是否引用已删代码。
- **排除项**：`2026-10-14-r5-timer-worker-host.md`（移动时仍在飞，留在原目录）。
- 同样落在历史区的还有 `docs/superpowers/specs/`（3 份设计稿，未移动）。

## 已知「会误导人」的点（少数仍会更新结论的条目）

| 条目 | 现状 |
|---|---|
| 任何引用 `RoomCapabilitiesService` / `MatrixRoomSummaryService` / `SynapseStickyEventService` / `useStickyEvents` 的计划 | 这些实现已在 **Batch 4.3（C2 收敛）** 删除，能力统一走 SDK 路径 |
| 任何以 `40.2.0-langkebo.0~.5` 为前提的计划 | 现行 pin 为 `40.2.0-langkebo.6 @ 0824bb23adb3`（2026-10-13） |
| `2026-08-06-matrix-http-client-remove-ui-side-effects.md` | 已在文件头加了过期横幅（其唯一调用方已被删除） |

## 查现状去哪

- 前端 ↔ SDK 集成现状：`docs/Tjg-SDK-集成架构与能力图谱-2026-10-08.md`（受
  `pnpm check:integration-map-freshness` 机器校验；其 HTML 孪生同目录）。
- 后端/SDK 问题清单与整改：`OPS_ARTIFACTS/TJG_MAP_DRIVEN_BACKEND_SDK_AUDIT_2026-10-13.md`。
- 提交与文档纪律：`.rules`（同时以 `AGENTS.md` / `CLAUDE.md` 符号链接暴露）。
