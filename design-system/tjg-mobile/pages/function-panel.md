# 页面覆盖 · 功能面板与相册/文件弹层

> 覆盖 [MASTER.md](../MASTER.md)。实现：[More.vue](../../../src/mobile/components/chat-room/panel/More.vue)、[MobilePanel.vue](../../../src/components/rightBox/chatBox/MobilePanel.vue)

## 功能面板（九宫格）

| 项 | 规格 |
| :--- | :--- |
| 容器 | `.tjg-glass--sheet`，圆角仅顶部 `--tjg-radius-2xl`，顶部 1px `--tjg-glass-border-soft` |
| 高度 | 内容自适应；最小 208px；横屏上限 60vh |
| 栅格 | 4 列，gap 12px；内边距 14px 14px 18px |
| 单项 | 最小 88px，`--tjg-radius-xl`，`--tjg-glass-row-bg`，按下 `--tjg-glass-row-bg-pressed` + 0.985 |
| 图标 | 44px 圆形，`--tjg-glass-tint-soft`，品牌色 SVG 24px，线宽 1.5px |
| 文字 | 11px（`--tjg-font-size-2xs`），`--tjg-text-secondary`，居中单行 |
| 顺序 | 图片、文件、语音、视频、链接预览、位置（按服务端能力与设置显隐） |

- 面板展开时输入坞保持可见，面板与键盘互斥：打开面板即收起键盘。
- 面板进入 320ms `translateY(24px)` + 淡入；退出 240ms，反向。
- 九宫格项 ≥ 6 个时自动两行；少于 4 个时保持左对齐，不居中拉伸。

## 相册 / 文件选择弹层

- 使用底部玻璃抽屉，顶部把手 36×4，标题 15px/600，右上“取消”14px。
- 媒体网格 3 列、gap 2px、单元格正方形；选中态：品牌色 2px 描边 + 右上角 20px 勾选圆点。
- 底部操作条：左“预览”，右“发送（n）”，高 48px，圆角 full。
- 文件项行高 56px，图标 40px，文件名 15px、大小 12px、`--tjg-text-tertiary`。

## 通话选择抽屉

- 两行主操作（视频通话 / 语音通话）+ 一行取消，行高 52px。
- 主操作文字 15px 主色；取消行 15px 次色，与主操作间距 6px。
- 进入 240ms 上滑淡入，遮罩 `--tjg-glass-scrim`。

## 交互

| 操作 | 表现 |
| :--- | :--- |
| 点击项 | 立即执行并收起面板（除多选类） |
| 再次点击扩展钮 | 面板收起，键盘回到上次状态 |
| 点击遮罩 | 收起面板 |
| 未授权 | 面板内就地显示 44px 行内提示 + “去设置”，不弹系统模态 |
| 多选 | 底部操作条常驻，计数变化 200ms 淡入 |

## 验收

- [ ] 6/8 项时栅格不错位，≤360px 屏不换行溢出
- [ ] 面板打开时输入坞不被遮挡，安全区正确
- [ ] 未授权、上传失败均有就地反馈
- [ ] 面板动画期间列表不重排
