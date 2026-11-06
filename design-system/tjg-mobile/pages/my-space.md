# 页面覆盖 · 我的 / 通讯录 / 空间

> 覆盖 [MASTER.md](../MASTER.md)。实现：[my/index.vue](../../../src/mobile/views/my/index.vue)、[MobileQuickActions.vue](../../../src/mobile/components/my/MobileQuickActions.vue)、[friends/index.vue](../../../src/mobile/views/friends/index.vue)、[rooms/index.vue](../../../src/mobile/views/rooms/index.vue)、[SpaceView.vue](../../../src/mobile/views/space/SpaceView.vue)

## 我的

1. **背景**：由 MobileLayout 提供 `.tjg-aurora`，页面自身不再铺底色。
2. **资料卡**：72px 高，左右 16px，`.tjg-glass--row`，圆角 `--tjg-radius-xl`；头像 56px，昵称 17px/600，签名 13px 次色。
3. **快捷入口**：5 列，整块作为一张玻璃卡（`--tjg-glass-row-bg`），图标 44px 圆形 `--tjg-glass-tint-soft`，文字 11px。
4. **昵称输入**：`--tjg-glass-input-bg` + 1px `--tjg-glass-border-soft`，圆角 `--tjg-radius-lg`，去掉 Vant 默认下划线。
5. **设置行**：56px，分隔线左侧缩进 16px，最后一行无线；危险项（退出登录）使用 `--tjg-color-danger-500` 文字，不铺满红色块。

## 通讯录

- 顶部搜索框 36px，`.tjg-glass--input`；未输入时显示“搜索手机号 / 昵称”。
- 搜索结果卡：`--tjg-radius-lg`、`--tjg-glass-row-bg`、1px `--tjg-glass-border-color`、内高光；卡间距 8px。
- 分组标题（字母索引）：12px，`--tjg-text-tertiary`，字母条宽 24px，触点热区 44px。
- 右侧索引条半透明胶囊，按下时放大 1.05 并显示当前字母气泡。

## 房间 / 空间

- 页面根节点 `.tjg-aurora`，内容区不再铺 `--tjg-surface-panel`。
- 房间列表整体作为一块玻璃面：外边距 0 12px 12px，圆角 `--tjg-radius-xl`，行内透明（避免逐行模糊）。
- 空间卡片：`--tjg-glass-row-bg` + `--tjg-glass-border-soft` + 内高光，圆角 `--tjg-radius-xl`；封面 16:9，信息区 12px 内边距；按下 0.985。
- 创建入口使用品牌色主按钮，高 48px，圆角 `--tjg-radius-xl`，文字白 15px/600。

## 交互

| 操作 | 表现 |
| :--- | :--- |
| 点击快捷入口 | 图标底变 `--tjg-glass-row-bg-pressed`，120ms 后跳转 |
| 点击设置行 | 整行 `--tjg-glass-row-bg-pressed`，右侧箭头 16px |
| 搜索输入 | 300ms 防抖，结果区 200ms 淡入，不清空滚动位置 |
| 空间卡片 | 按下缩放 0.985，松开 180ms 回弹 |
| 列表滚动 | 无模糊、无阴影变化，稳定 60fps |

## 验收

- [ ] 我的页所有入口热区 ≥ 44px
- [ ] 通讯录搜索框与房间列表在浅色背景图上文字清晰
- [ ] 空间卡片封面缺失时有玻璃占位，不出现白块
- [ ] 360px 屏快捷入口 5 列不溢出
