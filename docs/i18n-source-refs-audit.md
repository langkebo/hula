# i18n 源码引用可达性审计（2026-09-20）

## 一句话

`t('字面量')` 里写的键，**能否真的从语言包解析出来**——此前全仓没有任何门禁管这件事。
本轮量化存量、修复可机械判定的部分、建立 ratchet 门禁，并顺带揪出两个「测试为 bug 背书」的实例。

## 为什么这类缺陷能长期潜伏

现有 `scripts/check-i18n.mjs` 只校验 **zh-CN 与 en 的键集合对齐**，**不校验源码引用**。
于是「调用点写错命名空间前缀」这类缺陷可以长期存活：

- 界面直接渲染**原始 key**（`setting.xxx.yyy`），肉眼可见但无人报
- 所有组件测试照常全绿——因为组件测试的 `t` 桩是**照着源码的错键**写的映射表，
  源码与桩共用同一个错误路径，**永远自洽**

命名空间约定（最高频错因）：`locales/{lang}/{ns}.json` 的**文件名即顶层命名空间，
且首段必须剥掉**才落到 JSON 根：
`setting.encryption.title` → `setting.json` 的 `{ encryption: { title } }`。

## 存量量化（修复前）

扫描 `src` 下 `.vue/.ts/.tsx/.js`（排除 `__tests__`/`__mocks__`/`*.stories.*`/`*.d.ts`），
提取带点的 `t('字面量')`，按「首段剥掉」规则解析语言包。

**门禁口径（zh-CN 与 en 任一缺失即计入，去重键）**：

| 时点 | unresolved | fallback | 合计 |
| --- | --- | --- | --- |
| 修复前（用修复前文件备份实测） | 503 | 7 | **510** |
| 修复后 | 414 | 7 | **421** |

即本轮消除 **89 个去重键 / 111 处调用点**。

**分类口径（zh-CN 单语言，用于派工）**：

| 分类 | 键数 | 说明 |
| --- | --- | --- |
| 命名空间文件不存在 | 91 | `widget` 69 / `call` 7 / `push` 6 / `memoryMonitor` 4 / `private_mode` 3 / `e2ee` 2 |
| 补一个命名空间前缀即可解析 | 138 | 调用点漏写了前缀（**本轮主要战果**） |
| 其它（候选多个 / 无候选） | 280 | 需逐个定案 |

## 本轮修复：111 处调用点（10 个文件）

| 文件 | 键数 | 错键 → 真实路径 |
| --- | --- | --- |
| `components/widget/WidgetManager.vue`<br>`components/widget/WidgetDetailPanel.vue`<br>`components/widget/WidgetDialogs.vue` | 69 | `widget.*` → `common.widget.*`（`common.json` 的 `widget` 对象有 76 个子键，zh/en 两侧齐备） |
| `components/connection/SyncStatusBar.vue` | 5 | `connection.*` → `chat.connection.*`（另见下方「混用统一」） |
| `components/common/ErrorBoundary.vue` | 5 | `errorBoundary.*` → `errorBoundary.errorBoundary.*`（该文件顶层键就是 `errorBoundary`） |
| `components/common/MemoryMonitor.vue` | 4 | `memoryMonitor.*` → `components.memoryMonitor.*` |
| `mobile/components/thread/ThreadView.vue` | 5 | `thread.*` → `common.thread.*` |
| `components/thread/ThreadIndicator.vue`<br>`mobile/components/thread/ThreadIndicator.vue` | 2 | `thread.start` → `common.thread.start` |
| `components/encryption/KeyBackupRestoreDialog.vue` | 5 | `encryption.*` → `setting.encryption.*` |

判定原则（skill 口径）：**键确实存在于别处 → 改调用点；键处处不存在 → 补文案**。
批量替换带逐文件命中数断言（`n > 0` 否则报错），改完复核残留为 0。

### 顺带统一：`SyncStatusBar.vue` 的命名空间混用

同一个 computed 里 5 个状态，其中 4 个用 `chat.connection.*`，`reconnecting` 却用
`connection.reconnecting`（恰好能解析，故不在违规清单里）。两者**译文不同**：
`正在重新连接...` vs `重连中`。而测试断言的是 `重连中`（= `chat.connection.reconnecting` 的值），
说明**测试期望与应用实际显示早已背离**。已统一到 `chat.connection.*`。
> ⚠️ 这是一处**用户可见文案变更**（重连态：`正在重新连接...` → `重连中`），如不认可可在
> `components/connection/SyncStatusBar.vue` 单行回退；`connection.*` 命名空间本身仍被
> `ConnectionStatusBanner.vue` 正当使用（12 个键），未动。

## 两个「测试为 bug 背书」实例（本轮副产品，价值高于修复本身）

### 1. `SyncStatusBar.test.ts` 的自洽桩

修复调用点后，该文件 4 个用例立刻转红（`expected 'chat.connection.connecting' to be '正在连接...'`）。
原因：**桩的映射表键名是照着源码的错键抄的**。经核对，桩里的**译文与真实语言包逐字一致**——
作者抄对了译文、只跟着源码抄错了键。已同步 5 个键名。

**这类失败是修复正确性的证据，不是回归**：它证明此前该组件在真实应用里渲染的是原始 key，
而测试因为桩自造而全绿。

### 2. `useEncryption.requestUserVerification` —— 幻影 API（**未修，归并行 WIP**）

```ts
async function requestUserVerification(userId: string, _methods?: string[]) {
  return matrixVerificationService.startSasVerification(userId, '')   // ← 空 deviceId
}
```

链路定案（决定性证据取自 vendored SDK 实现）：

```
requestUserVerification(userId)
  → startSasVerification(userId, '')                    MatrixVerificationService.ts:176
  → crypto.requestDeviceVerification(userId, '')        同上 :184
  → olmMachine.getDevice(UserId(userId), DeviceId(''))  matrix-js-sdk rust-crypto.js:1108
  → if (!device) throw new Error("Not a known device")  :1109-1111
```

`deviceId = ''` **永远匹配不到设备 → 必然抛 `Not a known device`，成功率 0%**。

它之所以没被发现：

- **生产代码零调用**（全仓仅 `useEncryption.ts` 内部的声明、接口、导出三处）
- 只有 2 个单测覆盖，而它们断言的是「委托给了谁」而非**结果**，
  其中 `useEncryption.test.ts:459` 甚至把 bug 写成了期望值：
  `expect(mockVerificationStartSasVerification).toHaveBeenCalledWith('@user:server', '')`
  —— 配上永远 resolve 的 mock，**永不可能失败**

**结论**：`startSasVerification(userId, deviceId)` 的 `deviceId` 在 SDK 层是必填的，
「只给 userId 就发起验证」这条路在 v40 的 CryptoApi 上**不存在**。
P0-3 落地的「锁徽章 → 选设备 → `DeviceVerifyDialog`」流程（`useDeviceVerifyLauncher`）
已经是它的正确替代。建议**删除** `requestUserVerification`（声明 + 实现 + 导出 + 那 2 个无保护力的用例），
而不是尝试修补。该文件属并行 E2EE WIP，本轮**只诊断未改动**。

## 新增门禁

### 1. `scripts/check-i18n-refs.mjs`（ratchet）

- 双计数器，**分开计因为严重度不同**：
  - `unresolved`：`t('k')` 无兜底且解析不出 → 界面显示原始 key（**硬缺陷**）
  - `fallback`：`t('k', '默认文案')` 有兜底但解析不出 → 中文兜底在英文界面泄漏（**软缺陷**）
- `t('key', { count })` 是参数插值，**不算兜底**（否则大量假阳性）
- 基线 `meta/i18n-refs-baseline.json`，**按命名空间分布冻结**（单看总数会让「一处修好、另一处新增」互相抵消）
- `--update` 重刷基线；`--list` 打印全部违规键（派工用）
- 已接入 `package.json`：新增 `check:i18n-refs`，并把 `check` 串为
  `pnpm gen:i18n && biome check && node scripts/check-i18n.mjs && node scripts/check-i18n-refs.mjs`

**当前基线：`unresolved 411` / `fallback 7`**（第一轮修复后 414 → 第二轮修掉 `poll.*` 后 411；修复前 `unresolved` 为 503）。

### 2. `src/locales/__tests__/sourceRefs.test.ts`（18 用例，读**真实语言包**）

刻意不复用组件测试的 `t` 桩——这正是要防的东西。覆盖：

- 已修复的 9 个文件必须保持 **0** 残留（冻结战果）
- `KeyBackupRestoreDialog.vue` 的已知缺口（`encryption.backup_restore_dialog.*` 整棵子树缺失，32 个）
  用 `<= 32` 冻结且必须全为该子树前缀（**区别于路径错误**）
- 全仓总数不得超过基线（= `unresolved + fallback` 两桶之和，注意别只取一桶）
- 收集器自检（扫到 >300 文件、>100 违规），防止守卫静默空转
- **生成产物新鲜度**：`src/typings/i18n.d.ts` 必须与当前 `locales/zh-CN` 一致

### 3. 为什么需要「产物新鲜度」这条

`package.json` 的 `check` 是 `pnpm gen:i18n && ... node scripts/check-i18n.mjs`，
**先重生成再做检查** → CI 里 `i18n.d.ts` 永远被就地重写，**陈旧状态不可能被现有门禁发现**。

实测陈旧量：期望 253,944 字符 vs 提交的 252,989（**落后 955 字符**），
首个差异正是缺失的 `chat.connection` 组——即本仓 `t()` 的键类型与真实语言包长期脱节
（该文件经 `src/typings/vue-i18n.d.ts` 扩展 `DefineLocaleMessage`，是真实生效的）。

已用 `pnpm gen:i18n` 重生成（+32 行：`chat.connection` 7 / `chat.encryption` 8 /
`chat.cross_signing` 2 / 其余来自并行 WIP 语言包新增键）。
> ⚠️ 重生成内容**包含并行 WIP 的语言包新增键**（`setting.encryption.device_trust_*`、
> `device_verify_dialog.*`、`encryption.cross_signing.*`、`message_container.verify_sender_device`）。
> 是否随本轮一起提交，请与 P0-3 那 24 个暂存文件同样决策。

## 变异验证（全部有效）

| 变异 | 期望 | 实测 |
| --- | --- | --- |
| 把 `WidgetManager` 的 `common.widget.add` 还原成 `widget.add` | 脚本 FAIL + 测试点名该文件 | ✅ 双向 |
| 从 `locales/zh-CN/common.json` 删除 `widget.add` | 双向转红（证明读的是真实语言包，非桩） | ✅ 并逐字节还原 |
| 篡改 `src/typings/i18n.d.ts` 一个字符 | 新鲜度用例转红 | ✅ |
| 把 `KeyBackupRestoreDialog.vue` 的 `setting.encryption.recovery_key_required` 还原成 `encryption.*` | 测试从绿转红（拿到裸 key） | ✅ 逐字节还原；**改造前该变异不会红**，正是自洽桩的证据 |
| 往桩里注入 `chat.connection.bogus_key` | 桩键门禁转红并点名文件+键 | ✅ 逐字节还原 |
| 把本就能解析的 `chat.connection.connected` 加进白名单 | 「登记项不得陈旧」转红 | ✅ 逐字节还原 |

## 遗留

1. **`encryption.backup_restore_dialog.*` 整棵子树缺失（32 键）**：该子树在任何语言包中都不存在
   （`encryption.json` 只有 `backup_setup_dialog`，仅 1/32 与它重名），属**内容真缺**需补齐文案。
   位于 E2EE 特性域、与并行 WIP 的 key backup 工作重叠，**未擅自编写文案**。
2. **命名空间文件不存在（91 键）**：`widget`(69) 已被证明应指向 `common.widget.*` 的一部分已修，
   剩余 `call`/`push`/`memoryMonitor`/`private_mode`/`e2ee` 需确认是「建语言包文件」还是「改调用点」。
3. **其余键**需逐个定案（`unresolved 411` 中扣除上述两类）。第二轮已清掉 `poll.*` 3 键。
4. **`i18n.d.ts` 的提交时机**：见上（含 WIP 键）。
5. **`requestUserVerification` 幻影 API** 建议删除，归并行 WIP，未改动。

## 第二轮（同日续）：从「修调用点」升级为「堵住缺陷来源」

第一轮修的是**症状**（111 处错键）。第二轮修的是**成因**。

### 1. 第三例自洽桩 —— `RenderPollMessage.test.ts` 掩盖的是**真实生产缺陷**

本轮建立桩键门禁后立刻抓到：

| 位置 | 桩里声明的键 | 组件源码用的键 | 真实语言表里有吗 |
| --- | --- | --- | --- |
| `RenderPollMessage.test.ts` | `poll.votes` / `poll.ended` / `poll.ends_at` | ← 完全相同 | ❌ 只有 `poll.message.votes` / `poll.message.ended`，`poll.ends_at` 不存在 |

即：**测试与组件用同一个错键，双方互证，语言表被架空**。真实后果是聊天里的投票卡片
直接渲染 `poll.votes` / `poll.ended` / `poll.ends_at` 三个裸键。

> 排查陷阱：本轮曾用 Bash `grep` 查 `RenderPollMessage.vue` 是否调用 `t('poll.*')`，
> 返回**空**（假阴性），一度误判为「桩里的孤儿条目、无害」。
> 换用 ripgrep 工具后立刻看到第 29–31 行确在使用。
> **本仓的「找不到」结论必须用 `Grep` 工具复核**（已写入项目记忆）。

顺带发现同一文件的**第二类缺陷**：语言表占位符写成 Handlebars 风格 `{{count}}`，
而 vue-i18n 的插值语法是 `{count}` → 渲染成 `{0} 人投票`（多了一对大括号）。
全仓仅 `poll.json` 中招（每语言 4 处：`create.option_placeholder`、`message.votes`、
`message.minutes`、`message.hours`），已一并修正，并新增脚本 `--list` 之外的核验方式见下。

修复内容：

- `RenderPollMessage.vue`：3 个键改为 `poll.message.*`，`votes` 改用插值
  （`t('poll.message.votes', { count })`，去掉模板里重复的裸数字）
- `locales/{zh-CN,en}/poll.json`：新增 `message.ends_at`（截止 / Ends at），
  并把 4 处 `{{n}}` / `{{count}}` 改为 `{n}` / `{count}`
- `RenderPollMessage.test.ts`：删掉自洽桩，改用 `createI18nMock()`

> 用户可见文案变更：`0 票` → `0 人投票`（跟随语言表原有的 `{count} 人投票`）。

### 2. 共享测试助手 `tests/i18n-messages.ts`

把「读真实语言表」内联复制到每个测试文件是下一个自洽桩的温床，故抽为助手：

```ts
// tests/i18n-messages.ts
export const resolveMessage = (key, localeDir?) => …   // 按「首段即文件名」解析
export const interpolate = (text, params?) => …        // {name} 插值
export const createI18nMock = ({ provisional, localeDir } = {}) => ({ useI18n: () => ({ t, te, … }) })
```

关键设计：**解析不到就返回裸 key，不抛错也不静默兜底** —— 让断言直接看到未翻译的键名。
`provisional` 只用于已登记的**内容缺口**，与门禁白名单双向绑定（见下）。

已迁移：`KeyBackupRestoreDialog.test.ts`、`SyncStatusBar.test.ts`、`RenderPollMessage.test.ts`。

### 3. 新增门禁：桩键可达性（`sourceRefs.test.ts` 15 → 18 用例）

扫 `src/**/*.test.ts` 中 `vi.mock('vue-i18n')` 工厂内的对象键，逐个对**真实语言表**解析：

- `测试桩声明的键必须能在真实语言表解析出来` —— 白名单外一律 FAIL，报错信息点名文件+键
- `登记项不得陈旧` —— 白名单里的键一旦已能解析，必须删除（防白名单注水）
- `收集器自检` —— 必须扫到 >150 个测试文件、>100 个键，防守卫静默空转

白名单当前 3 项，全部是 `KeyBackupRestoreDialog` 的已知内容缺口（见「遗留 1」）。

**为什么这一条比第一轮的脚本更关键**：`check-i18n-refs.mjs` 只扫**生产源码**，
而缺陷的实际载体在**测试桩**里 —— 只扫源码永远看不见「桩与语言表脱节」。

### 4. 顺手修掉一个 HEAD 就存在的红灯（非本轮引入）

`RoomCard.test.ts` 断言 `[data-testid="room-federation-badge"]`，但 `FederationBadge.vue`
的 testid 是 `federation-badge`（该组件自身测试、`FriendDetailsSections.test.ts` 均用后者，
是仓库主流命名）。三个文件在 `git status` 中均为**未修改**，即 HEAD 状态下就红。
已把测试改为跟随主流命名（未动组件，避免影响另外 3 个依赖该 testid 的测试）。

> 此项推翻上一轮「RoomCard 联邦徽章可能是**功能缺失**」的猜测：
> 功能一直在，是**测试契约与实现命名不一致**。

## 复现命令

```bash
node scripts/check-i18n-refs.mjs            # 门禁校验
node scripts/check-i18n-refs.mjs --list     # 打印全部违规键 + 命名空间分布
node scripts/check-i18n-refs.mjs --update   # 清理后重刷基线
npx vitest run src/locales/__tests__/sourceRefs.test.ts
```
