# 页面覆盖 · 会话列表（/mobile/message）

> 覆盖 [MASTER.md](../MASTER.md) 中的页面级规则；材质与 token 仍遵循 MASTER。
> 实现：[MobileSessionList.vue](../../../src/mobile/components/message/MobileSessionList.vue)、[views/message/index.vue](../../../src/mobile/views/message/index.vue)

## 布局结构（自上而下）

1. **背景层**：页面自定义背景图（`bg-mobile-home`）铺满，之上压一层 8% 的 `--tjg-glass-scrim`，保证玻璃面与图片之间有稳定对比。
2. **搜索区**：高 56px，左右 16px；搜索框 36px 高、`.tjg-glass--input`、圆角 full、字号 15px。
3. **会话列表**：虚拟列表，行高 72px；顶部内容与搜索区间距 4px。
4. **标签栏**：`.tjg-glass--tabbar`，由 MobileLayout 提供。

## 视觉要点

- 行背景 `--tjg-glass-row-bg`，不使用模糊；相邻行间距 0，通过 1px 透明间隙与 `inner-highlight` 区分。
- 未读会话标题字重 600，已读 500；摘要统一 `--tjg-text-secondary`。
- 置顶会话在标题前加 14px 的“置顶”角标（品牌色 20% 底 + 品牌色文字），不使用图钉 emoji。
- 未读徽标：18px 高、`--tjg-radius-full`、`--tjg-color-primary-500` 底、白字 11px；>99 显示 `99+`。
- 空态：居中偏上 12vh，SVG 插图 96px + 说明 14px + “发起聊天”主按钮。

## 交互

| 操作 | 反馈 |
| :--- | :--- |
| 单击 | 行背景 → pressed，120ms 后进入聊天页（推入 420ms） |
| 长按 500ms | 玻璃菜单（删除 / 置顶 / 标记已读），锚点跟随触点 |
| 左滑 | 置顶（品牌色）+ 删除（危险色），每键 80px |
| 下拉 | 刷新，阻尼 0.5，指示器为品牌色圆环 |
| 滚动 | 搜索区不吸顶；滚动 > 8px 时搜索区加 92% 底确保可读 |

## 响应式

- ≤360px：左右留白 12px，摘要字号降到 13px，头像 44px。
- ≥431px：列表最大宽 560px 居中，行高保持 72px。

## 验收

- [ ] 列表滚动 60fps，无逐行模糊
- [ ] 选中态渐变与未读徽标同时存在时不互相遮挡
- [ ] 长按菜单在屏幕底部行自动向上翻转
- [ ] 背景图缺失时回退 `.tjg-aurora`，不出现纯白空屏
