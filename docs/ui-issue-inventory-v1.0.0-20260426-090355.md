# 项目UI问题清单

## 文档信息

- 版本: `v1.0.0`
- 生成时间: `2026-04-26 09:03:55`
- 输出范围: 桌面端主工作区、设置窗口、主题样式层、房间/空间相关界面
- 调研依据:
  - `docs/desktop-settings-unification-2026-04-26.md`
  - `src/layout/center/index.vue`
  - `src/views/settingsWindow/index.vue`
  - `src/views/settingsWindow/SettingsDialog.vue`
  - `src/views/moreWindow/settings/index.vue`
  - `src/components/space/SpacePanel.vue`
  - `src/views/homeWindow/SpaceView.vue`
  - `src/styles/scss/global/variable.scss`
  - `src/styles/scss/theme/simple.scss`
  - `src/styles/scss/theme/default.scss`

## 评估口径

- 优先级:
  - `P0`: 会直接造成双入口、死链、明显视觉错乱或后续改造阻塞
  - `P1`: 高频场景不一致，已显著影响统一体验和组件复用
  - `P2`: 中低频不一致，短期可容忍但会持续放大维护成本
- 技术债评估:
  - `高`: 已形成多源真相、跨层耦合或死代码依赖
  - `中`: 可通过局部重构收敛，但会影响多个页面
  - `低`: 主要是视觉微差或文案统一问题
- 截图证据说明:
  - 当前会话未启动 GUI 实机采集，本清单先给出“建议截图点位 + 代码证据”。
  - 后续执行验收时，应按文中 `S-xx` 点位补齐真实截图。

## 结构化问题清单

| ID | 问题分类 | 问题描述 | 影响范围 | 优先级 | 截图证据 | 复现路径 | 技术债评估 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| UI-001 | 组件 | 设置体系存在“双壳层并存”: 新版 `settingsWindow` 已作为主入口，但旧版 `moreWindow/settings/index.vue` 仍完整保留并承载侧边栏、页脚、骨架屏与局部业务能力。 | 桌面端设置窗口、主窗口设置弹层、后续设置页重构 | P0 | `S-01 设置页双实现对比`；代码证据: `src/views/settingsWindow/index.vue`、`src/views/moreWindow/settings/index.vue` | 启动桌面端，分别进入 `/settings` 与旧设置组件依赖路径，观察同类配置被两套容器承载 | 高，属于双实现长期并存，后续任何设置项改动都要做双向核对 |
| UI-002 | 配色 | 主题皮肤入口虽已逻辑收敛到 `simple`，但 `default.scss` 仍在仓库内、`themes.versatile` 仍被状态层维护，形成“运行时单皮肤、代码层双皮肤”的伪统一。 | 桌面端主题系统、设计基线、样式清理 | P0 | `S-02 主题切换残留入口`；代码证据: `src/App.vue`、`src/styles/scss/theme/simple.scss`、`src/styles/scss/theme/default.scss`、`src/stores/domains/settings/setting.ts` | 检查启动样式加载与主题配置状态，再对比仓库内仍保留的 `default` 皮肤变量 | 高，多源主题定义会持续制造“该删不删、该改不敢改”的维护风险 |
| UI-003 | 配色 | 全局颜色来源至少包含 `variable.scss`、`simple.scss`、`default.scss`、`design-tokens.css` 和组件内硬编码，缺乏单一权威 Token 注册中心。 | 全局桌面端界面 | P0 | `S-03 同屏颜色来源冲突`；代码证据: `src/styles/scss/global/variable.scss`、`src/styles/css/design-tokens.css` | 搜索颜色变量和十六进制值，可见样式来源分散 | 高，属于典型“样式真相分裂” |
| UI-004 | 配色 | 设置窗口仍大量使用 fallback 色值和硬编码色值，如 `var(--bg-color, #fff)`、`#1a1a1a`、`#d46b08`、`#aaa`，未完全服从统一 Token。 | 新版设置窗口、设置各 Tab | P1 | `S-04 设置页深浅色不一致`；代码证据: `src/views/settingsWindow/SettingsDialog.vue`、`src/views/settingsWindow/tabs/*` | 打开设置窗口，切换浅色/深色，观察警示条、卡片底色、辅助文字色 | 高，改主题或做品牌升级时需要逐页返工 |
| UI-005 | 布局 | 主工作区 `center` 的头部当前仅承载搜索与新增菜单，布局已经拥挤，尚未为“房间/空间”复合组件预留统一承载区，导致能力只能继续外挂。 | 主页面左中工作区 | P0 | `S-05 主工作区头部拥塞`；代码证据: `src/layout/center/index.vue` | 打开主页面，观察搜索框、加号面板与列表区域之间没有统一导航层 | 高，会阻塞房间/空间复合组件接入 |
| UI-006 | 组件 | 房间与空间相关能力分散在 `RoomVirtualList`、`SpacePanel`、`SpaceView`、`center/index.vue`、多个 composables/store 中，存在多个列表容器和多个详情入口。 | 主工作区、空间管理、房间浏览 | P0 | `S-06 房间/空间多套列表并存`；代码证据: `src/components/room/RoomVirtualList.vue`、`src/components/space/SpacePanel.vue`、`src/views/homeWindow/SpaceView.vue` | 依次查看房间列表、空间面板、空间详情页，视觉与交互模式不同 | 高，组件粒度错位且缺少统一页面模板 |
| UI-007 | 交互 | 搜索框聚焦后直接路由跳转 `/searchDetails`，并通过全局 click 监听回退；这与主列表内联搜索范式冲突，也增加状态丢失风险。 | 主工作区搜索、会话查找 | P1 | `S-07 搜索跳页交互`；代码证据: `src/layout/center/index.vue` | 在主工作区点击顶部搜索框，再点击列表空白处，观察路由前进/后退行为 | 中，交互路径隐式依赖路由和事件冒泡，后续组合房间/空间筛选会变复杂 |
| UI-008 | 组件 | 输入区 `MsgInput.vue` 仍直接依赖旧设置目录下的 `config.ts` 获取发送选项，说明旧设置实现并非真正孤立，而是被其他核心组件引用。 | 聊天输入框、旧设置模块清理 | P0 | `S-08 旧设置目录隐藏依赖`；代码证据: `src/components/rightBox/MsgInput.vue` | 检查输入框发送选项来源，发现跨到 `src/views/moreWindow/settings/config.ts` | 高，删除旧设置目录前若不拆耦会引发隐性回归 |
| UI-009 | 交互 | `SpacePanel.vue` 点击后跳转 `name: 'space'` 和 `name: 'create-space'`，但桌面路由未定义对应命名路由，存在死链或不可达交互。 | 空间入口、桌面端导航 | P0 | `S-09 空间入口死链`；代码证据: `src/components/space/SpacePanel.vue`、`src/router/routes/desktop.ts` | 从空间面板触发点击与创建动作，检查桌面端路由表 | 高，功能入口存在但无法形成完整流转 |
| UI-010 | 布局 | 旧设置窗口采用左侧固定菜单 + 右侧滚动主体，新设置窗口采用双栏对话框式 Shell；同类“设置”场景有两套信息层级、间距、标题和页脚策略。 | 设置场景整体体验 | P1 | `S-10 设置壳层风格冲突`；代码证据: `src/views/moreWindow/settings/index.vue`、`src/views/settingsWindow/SettingsDialog.vue` | 对比新旧设置容器的标题区、边栏宽度、滚动区域、页脚布局 | 高，用户记忆模型无法稳定沉淀 |
| UI-011 | 文案 | 设置窗口中仍存在硬编码中文文案，如“未找到匹配的设置项”“搜索设置项”“有未保存的更改”；与项目 i18n 体系不完全一致。 | 设置窗口、多语言体验 | P1 | `S-11 文案国际化断层`；代码证据: `src/views/settingsWindow/SettingsDialog.vue` | 切换语言后进入设置窗口，核查中文是否仍保留 | 中，会影响国际化验收和文案统一治理 |
| UI-012 | 配色 | 主工作区与设置区存在大量局部硬编码十六进制/透明色，例如 `#c8c8c833`、`#ed6a5eff`、`#000`、`#909090`，与全局 Token 不一致。 | 主工作区、设置页局部控件 | P1 | `S-12 局部硬编码色块`；代码证据: `src/layout/center/index.vue`、`src/layout/center/model.tsx`、`src/views/settingsWindow/tabs/*` | 检查拖拽柄、关闭按钮、说明文字、状态标签 | 中，视觉会在主题切换和品牌统一时出现漏网区域 |
| UI-013 | 组件 | `SpacePanel.vue` 使用 `--bg-color-hover`、`--bg-color-active`、`--text-color-secondary` 等变量，但这些变量并未在当前权威 Token 文件中完整定义，形成“组件自以为有 Token、全局并未提供”的错配。 | 空间面板、公共组件体系 | P1 | `S-13 组件引用悬空变量`；代码证据: `src/components/space/SpacePanel.vue`、`src/styles/scss/global/variable.scss` | 比对组件用到的变量名与全局变量定义 | 高，容易造成某些页面正常、某些页面退回 fallback 的现象 |
| UI-014 | 布局 | `SpaceView.vue` 已经是一整页卡片化布局，而主工作区房间列表仍是窄栏式虚拟列表；信息密度、卡片视觉、入口位置与操作模式完全不同。 | 房间/空间浏览场景 | P1 | `S-14 房间与空间布局割裂`；代码证据: `src/views/homeWindow/SpaceView.vue`、`src/components/room/RoomVirtualList.vue` | 对比房间列表和空间页面的密度、留白、卡片结构、操作位 | 中，不利于整合为“房间/空间”统一工作区 |
| UI-015 | 组件 | 颜色硬编码问题已不是局部个案，静态搜索显示桌面与相关组件中存在大量十六进制/rgba 使用，整体上已超过零散修补阈值。 | 全局样式治理 | P1 | `S-15 硬编码颜色热区分布`；代码证据: 全仓静态搜索结果，约 `988` 处命中、涉及约 `200` 个文件 | 全仓检索 `#xxxxxx`、`rgba(` 等模式 | 高，应作为专项治理，不适合靠“顺手修一下”解决 |

## 截图补录清单

| 编号 | 建议截图画面 | 目标 |
| --- | --- | --- |
| S-01 | 新旧设置窗口并排截图 | 证明同类设置场景存在两套壳层 |
| S-02 | 主题配置入口与运行时样式加载截图 | 证明“逻辑收敛但代码未清理” |
| S-03 | 同一页面不同区域色彩来源对比 | 证明 Token 来源分裂 |
| S-04 | 设置窗口浅色/深色模式截图 | 证明 fallback 色值与 Token 不一致 |
| S-05 | 主工作区顶部搜索和新增按钮区域截图 | 证明没有房间/空间统一承载位 |
| S-06 | 房间列表、空间面板、空间页面三处界面对比 | 证明组件冗余和能力碎片化 |
| S-07 | 搜索框聚焦跳页前后截图 | 证明搜索交互不一致 |
| S-08 | 输入框发送选项与旧设置配置的代码/界面对照 | 证明隐藏依赖 |
| S-09 | 空间入口点击后的路由异常或不可达状态 | 证明死链问题 |
| S-10 | 新旧设置容器标题区和边栏对比 | 证明布局策略不一致 |

## 当前处理进展

- 更新时间: `2026-04-27`
- 已局部缓解的问题:
  - `UI-003`: 当前已明确以 `src/styles/css/design-tokens.css` 为运行时权威 Token 注册中心，并继续把 `simple.scss`、`variable.scss`、`default.scss` 的主题别名回收至 `--hula-*`；菜单浮层、Beta 辅助色和管理后台色板也已开始进入同一 Token 注册中心，`variable.scss` 中无外部消费的 `--box-shadow-color`、`--emoji-hover`、`--emoji-active-color` 也已完成物理删除
  - `UI-012`: `simple.scss` 与 `variable.scss` 已完成两轮高频硬编码色值替换，覆盖侧边栏、消息列表、图标、禁用态、插件区、文件区、消息气泡、回复态、菜单层与管理后台色板等区域；`settingsWindow` 的全部 16 个 Tab，以及 `ChatSidebar.vue`、`ReactionPicker.vue`、`MessageEditor.vue`、`Announcement.vue`、`LinkPreview.vue`、`Location.vue`、`Beacon.vue`、`AddFriendDialog.vue`、`FriendGroupView.vue`、`InviteDialog.vue`、`CreateRoomDialog.vue`、`ChatMain.vue`、`ChatFooter.vue`、`ChatMsgMultiChoose.vue`、`Text.vue`、`File.vue`、`Voice.vue`、`ChatMultiMsg.vue`、`renderMessage/index.vue`、`Image.vue`、`Emoji.vue`、`Video.vue`、`special/BotMessage.vue`、`ChatHeaderRoot.vue`、`ChatHeaderSidebar.vue`、`ChatHeaderInfo.vue`、`ForwardDialog.vue`、`ApplyList.vue`、`ReplyComposer.vue`、`RenderPollMessage.vue`、`LocationModal.vue`、`MsgInput.vue`、`VoiceRecorder.vue`、`emoticon/index.vue`、`chatBox/HuLaAssistant.vue`、`chatBox/Bot.vue` 与共享 `render-message.scss`、`msg-input.scss` 等右侧聊天区高频组件也已完成一轮向 `--hula-*` 的样式迁移
  - `UI-015`: 主工作区 `src/layout/center/model.tsx` 已去除两处直接写死的灰色文字样式，右侧聊天主区的 `ChatMain.vue`、`ChatFooter.vue`、`ChatMsgMultiChoose.vue`、`ChatHeaderRoot.vue`、`ChatHeaderSidebar.vue`、`ChatHeaderInfo.vue`、`ForwardDialog.vue`、`ApplyList.vue`、`ReplyComposer.vue`、`RenderPollMessage.vue`、`LocationModal.vue`、`MsgInput.vue`、`VoiceRecorder.vue`、`emoticon/index.vue`、`chatBox/HuLaAssistant.vue`、`chatBox/Bot.vue`、`chatBox/index.vue`、`location/StaticProxyMap.vue`、`location/LocationMap.vue`、`components/search/SpotlightDialog.vue` 与消息组件 `Text.vue`、`File.vue`、`Voice.vue`、`Image.vue`、`Emoji.vue`、`Video.vue`、`special/BotMessage.vue`、共享 `render-message.scss`、`msg-input.scss` 也已继续清理链接卡片、弹层、进度环、媒体遮罩、失败态、回复态、公告态、定位面板、输入联想层、表情面板、语音录制面板、机器人工作区、分割拖拽柄、地图控件、搜索弹窗和占位遮罩中的十六进制/rgba 色值与历史别名
- 仍未解决的关键问题:
  - `UI-001`、`UI-008`、`UI-010`: 设置壳层双实现与旧设置隐藏依赖仍然存在
  - `UI-002`: `default.scss` 虽已开始改为直接消费 `--hula-*`，且当前未见桌面端显式运行时导入；`setting.ts` 中 `themes.versatile` 固定为 `simple`，代码侧也未发现 `.default` 主题类动态挂载，但仓库内仍保留该文件，主题代码层尚未完成物理清理
  - `UI-005`、`UI-006`、`UI-009`、`UI-014`: 主工作区与房间/空间统一承载仍未开始实施
  - `UI-004`、`UI-013`: 旧别名变量、悬空变量与设置壳层之外的样式消费点仍有进一步清理空间；`FileContent.vue`、`AvatarCropper.vue`、`ContextMenu.vue`、`InfoEdit.vue`、`InfoPopover.vue`、`definePlugins/List.vue`、`model.tsx`、`Login.vue` 中已确认的 `--line-color`、`--chat-text-color` 消费点已完成收敛
  - `UI-011`: 设置偏好页中的语言选项和发送键选项已改为消费 i18n 文案键，设置壳层的导航标题、当前标签标题与搜索索引也已接入运行时翻译来源，`SettingsDialog.vue`、`useSettingsShell.ts`、`settingsSearchIndex.ts` 与 `settingsSchema.ts` 已完成一轮联动收敛；但设置体系其余日志与提示文案仍需继续统一

## 总体结论

- 当前桌面端 UI 的核心问题不是单点缺陷，而是“主题、容器、组件、入口、交互”五层同时存在历史并存。
- 最优解不是继续在旧页面上打补丁，而是以当前 `simple` 桌面样式为唯一标准，建立单一 Design Tokens、单一工作区模板、单一设置壳层、单一房间/空间组件体系。
- 在进入代码改造前，必须先拆掉旧设置目录的跨模块引用，并把空间入口死链、样式变量悬空、搜索跳页模式纳入统一方案，否则后续实现会反复返工。
