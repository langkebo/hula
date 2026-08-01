# ADR-004: 品牌色双层策略

## 1. 状态

- 已接受

## 2. 背景

- 当前问题：项目品牌色同时存在两套表达——深青绿 `#13987f`（用于品牌识别）与亮青绿渐变 `#4ecdc4 → #3db8a8`（用于左侧栏背景与会话选中态高亮）。表面看似冗余，但源于一个真实的技术约束。
- 触发原因：在 [NaiveProvider.vue](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/NaiveProvider.vue) 中接入 Naive UI 主题时发现，Naive UI 内部使用 `seemly` 与 `rgba()` 对颜色做 hover / pressed / focus 状态运算，**无法解析 CSS 变量引用**（如 `var(--hula-color-primary-500)`），必须传入具体 hex 值才能正确派生状态色。
- 业务约束：品牌色需要在 Naive UI 全局组件（Button / Input / Tabs / Switch / Radio / Slider 等）中一致呈现，且 hover/pressed 状态色彩需自动派生。
- 技术约束：CSS 变量是设计令牌系统的核心载体，无法放弃；同时 Naive UI 的颜色运算机制不可更改。

## 3. 决策目标

- 解决「单一 CSS 变量无法同时满足 Naive UI 颜色运算与设计令牌系统」的矛盾
- 保持品牌色在自定义组件（用 CSS 变量）与 Naive UI 组件（用 hex）之间视觉一致
- 让深浅两层品牌色各有明确语义：深色 = 品牌识别，亮色渐变 = 交互高亮
- 不引入运行时颜色解析库（如运行时 seemly 包装层）

## 4. 决策内容

采用品牌色双层策略：

- 决定 1：深青绿 `#13987f` 作为品牌识别色，定义为 `--hula-brand`，并通过 `--hula-color-primary-500` 等令牌暴露给自定义组件使用。
- 决定 2：亮青绿渐变 `#4ecdc4 → #3db8a8` 作为交互高亮色，定义为 `--hula-surface-session-active`（会话选中态）与 `--left-bg-color`（左侧栏背景），仅用于自定义组件的渐变场景。
- 决定 3：在 [NaiveProvider.vue:59-65](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/NaiveProvider.vue#L59-65) 维护一个 `primaryColors` 常量对象，**硬编码**深青绿的 hex 值（500/400/600/200/100），传入 Naive UI 的 `themeOverrides`。该常量是 `--hula-color-primary-*` 令牌的「具体值镜像」。
- 决定 4：亮青绿渐变不传入 Naive UI（Naive UI 不需要渐变），仅由 CSS 变量驱动自定义组件。
- 决定 5：当 `--hula-brand` 色值变更时，必须**同步**修改 `NaiveProvider.vue` 的 `primaryColors` 常量，二者构成一个 invariant。在 `NaiveProvider.vue:53-58` 的注释中已明确记录此约束。

## 5. 备选方案

### 方案 A：品牌色双层策略（推荐，已采纳）

- 说明：CSS 变量驱动自定义组件，hex 常量镜像驱动 Naive UI，两者通过 invariant 保持同步
- 优点：保留 CSS 变量系统的灵活性，Naive UI 颜色运算正常工作，无运行时开销
- 缺点：色值变更需双写，存在不一致风险
- 不采用原因：无，此为推荐方案

### 方案 B：运行时解析 CSS 变量后传入 Naive UI

- 说明：在应用启动时通过 `getComputedStyle(document.documentElement).getPropertyValue('--hula-color-primary-500')` 读取变量值，再传给 Naive UI
- 优点：单一数据源，无需双写
- 缺点：增加启动时序复杂度；CSS 变量变更（如深色模式切换）需要重新计算并重设 Naive UI themeOverrides；与 Naive UI 的响应式主题切换机制冲突
- 不采用原因：运行时开销与复杂度高于双写方案，且深色模式切换会引入额外 bug 风险

### 方案 C：放弃 CSS 变量，全量使用 hex

- 说明：在 design-tokens.css 中将 `--hula-color-primary-500` 直接定义为 `#13987f` 字面量，并在所有组件中硬编码 hex
- 优点：Naive UI 与自定义组件完全一致，无 invariant
- 缺点：失去设计令牌系统的核心价值（主题切换、可维护性、一致性）
- 不采用原因：与项目 design-tokens.css 设计哲学冲突

## 6. 影响分析

### 正向影响

- Naive UI 组件的 hover / pressed / focus 状态色彩正确派生，与品牌色一致
- 自定义组件继续享受 CSS 变量带来的主题切换能力
- 双层语义清晰：深色 = 品牌，渐变 = 交互高亮

### 负向影响

- `--hula-brand` 色值变更必须双写（design-tokens.css + NaiveProvider.vue primaryColors）
- 新成员可能误以为两层是冗余，尝试「统一」而导致 Naive UI 状态色失效

### 迁移成本

- 人力：无（已落地）
- 时间：无
- 风险：未来色值变更时漏改 NaiveProvider.vue 的 primaryColors

## 7. 实施计划

| 阶段 | 动作 | 负责人 | 验收标准 |
|---|---|---|---|
| 已完成 | 在 NaiveProvider.vue 维护 primaryColors 常量并接入 themeOverrides | 前端 | Naive UI Button/Input/Tabs 的 hover/pressed 状态色彩为青绿系 |
| 已完成 | 在 design-tokens.css 定义 `--hula-brand` 与 `--hula-color-primary-*` 令牌 | 前端 | 自定义组件使用 `var(--hula-color-primary-500)` 正确渲染 |
| 持续 | 任何品牌色变更必须双写两处 | 前端 | 代码审查 checklist 包含此 invariant |

## 8. 测试与验证

- 单元测试：无（CSS 与主题配置不写单元测试）
- 集成测试：无
- E2E 测试：在设置页验证 Naive UI Button hover/pressed 状态色彩为青绿系
- 性能验证：无运行时开销，无需验证
- 安全验证：不适用

## 9. 灰度与回滚

- feature flag：不适用（已全量生效）
- 灰度范围：不适用
- 回滚条件：若未来 Naive UI 升级后支持 CSS 变量解析，可考虑迁移到方案 B
- 回滚方式：移除 NaiveProvider.vue 的 primaryColors 常量，将 themeOverrides 改为引用 CSS 变量

## 10. 风险与未决问题

- 风险 1：品牌色变更时漏改 NaiveProvider.vue 的 primaryColors 常量，导致 Naive UI 状态色与自定义组件不一致。**缓解**：在 [CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) 与 [NaiveProvider.vue:53-58](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/NaiveProvider.vue#L53-58) 注释中明确该 invariant；后续可考虑增加 lint 规则检查二者一致性。
- 风险 2：新成员误将 `--hula-color-primary-500` 直接传入 Naive UI 的 `themeOverrides`，导致 hover 状态色失效。**缓解**：NaiveProvider.vue 已集中管理所有 themeOverrides，业务代码不应直接修改 Naive UI 主题。
- 未决问题：亮青绿渐变是否应同步暴露给 Naive UI 的某些组件（如 Tabs 的 barColor）？当前决策为「不暴露」，未来若有需求需重新评估。

## 11. 关联信息

- 关联 Issue：无
- 关联 PR：无
- 关联文档：[CONTEXT.md](file:///Users/ljf/Desktop/hu_ts/hula/CONTEXT.md) - 品牌色双层策略术语定义；[docs/ui/optimization-plan.md](file:///Users/ljf/Desktop/hu_ts/hula/docs/ui/optimization-plan.md) - 视觉一致性收尾方案
- 关联实施方案：[NaiveProvider.vue:53-65](file:///Users/ljf/Desktop/hu_ts/hula/src/components/common/NaiveProvider.vue#L53-65)、[design-tokens.css:5-15](file:///Users/ljf/Desktop/hu_ts/hula/src/styles/css/design-tokens.css#L5-15)

## 12. 审批记录

| 角色 | 姓名 | 结论 | 日期 |
|---|---|---|---|
| 前端负责人 | 待填写 | 已接受 | 2026-07-29 |

---

## 使用说明

本 ADR 记录「品牌色双层策略」的设计决策。该决策已落地于代码中（见关联实施方案），本 ADR 的目的是让未来开发者理解「为什么不能用纯 CSS 变量驱动 Naive UI」，避免误「优化」导致 Naive UI 状态色失效。
