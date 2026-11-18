/**
 * matrix-js-sdk 类型扩展
 * 提供官方 SDK 缺失的类型定义
 */
/// <reference types="vite/client" />

// ⚠️ 这里必须显式导入所有在 `declare module 'matrix-js-sdk'` 内被引用的 SDK 类型。
// 历史坑（2026-10-11 审计 §13 发现）：本文件里 `Room` 是**未导入的裸名**，而文件内恰好有一个
// 本地 `interface Room { topic?: string }` 兜住了它 —— 于是 `getRoom(roomId): Room | null`
// 一直能编译。删掉那条幻影声明后，`Room` 变成不可解析，`client.getRoom()` 的返回类型**静默塌成
// `any`**，连带 6 处 `.map((m) => …)` 回调退化为隐式 any（strict 下报 TS7006）。
// 教训：augmentation 里引用 SDK 类型必须走 import，不能依赖本地同名声明的「巧合」。
import type { Body, IHttpOpts, IRequestOpts, QueryDict } from 'matrix-js-sdk'
import type { CryptoApi } from 'matrix-js-sdk/crypto'

declare module 'matrix-js-sdk' {
  // ==================== MatrixHttpApi 方法重载 ====================
  // SDK 的 authedRequest/request 签名使用 Method enum（nominal 类型，不接受字符串字面量）。
  // 此处添加 method: string 的方法重载，让 tjg 代码可以用 'GET'/'POST' 等字符串字面量调用。
  // Declaration merging 对方法是追加重载，与 SDK 已有的 Method 签名并存。
  interface MatrixHttpApi<O extends IHttpOpts> {
    authedRequest<T = unknown>(
      method: string,
      path: string,
      queryParams?: QueryDict,
      body?: Body,
      paramOpts?: IRequestOpts
    ): Promise<T>
    request<T = unknown>(
      method: string,
      path: string,
      queryParams?: QueryDict,
      body?: Body,
      opts?: IRequestOpts
    ): Promise<T>
  }

  // ==================== SlidingSync 方法扩展 ====================
  // setInitialPos 是 SDK 源码中存在的 public 方法（sliding-sync.ts:334），但部分 SDK 构建的
  // .d.ts 未导出该方法，此处补充类型声明以支持 MatrixSyncManager 的增量 sync pos 持久化。
  interface SlidingSync {
    /** 设置初始 pos，用于重启后增量 sync。必须在 start() 之前调用。SDK: sliding-sync.ts:334 */
    setInitialPos(pos: string): void
  }

  // ==================== Room 属性扩展 ====================
  // tjg 代码直接访问 room.topic（SDK 的 Room class 没有此属性，需通过 currentState 获取）。
  // 此处添加 topic 属性扩展，避免大量代码重构。
  // ==================== 补充 SDK 缺失的类型 ====================

  // Note: These types exist in matrix-js-sdk/@types/partials.ts but are not exported from main index
  // We re-export them here for convenience

  // ==================== 接口补充 ====================
  // Note: ICreateRoomOpts exists in matrix-js-sdk/@types/requests.ts but is not exported from main index
  // We re-export it here for convenience

  export interface IPublicRoomsOpts {
    limit?: number
    since?: string
    server?: string
    filter?: {
      generic_search_term?: string
      room_types?: string[]
    }
    include_all_networks?: boolean
    third_party_instance_id?: string
  }

  // 同名防重逃生阀：synapse-rust 的 create_room 支持 ignore_duplicate_name，
  // 用户在确认弹窗选择"仍然创建"后置 true 重发，跳过 409 M_ROOM_IN_USE 查重。
  // ⚠️ 不要给 createRoom 加 `room_types`：SDK 会原样透传给 POST /createRoom，
  // 而 synapse-rust 是严格 schema（400 M_BAD_JSON）。空间请用 `creation_content: { type: 'm.space' }`。
  interface ICreateRoomOpts {
    ignore_duplicate_name?: boolean
  }

  export interface SlidingSyncList {
    ranges: number[][]
    sort: string[]
    timeline_limit: number
    required_state: Array<[string, string]>
  }

  export interface SlidingSyncRoomSubscription {
    timeline_limit: number
    required_state: Array<[string, string]>
  }

  // Note: ISendEventResponse exists in matrix-js-sdk/@types/requests.ts but is not exported from main index
  // We re-export it here for convenience

  export interface ILoginRequest {
    type: string
    user?: string
    password?: string
    device_id?: string
    initial_device_display_name?: string
    token?: string
    [key: string]: unknown
  }

  export interface IRegisterRequest {
    username?: string
    password?: string
    device_id?: string
    initial_device_display_name?: string
    inhibit_login?: boolean
    auth?: Record<string, unknown>
    [key: string]: unknown
  }

  export interface IMemberEvent {
    membership?: string
    avatar_url?: string
    displayname?: string
  }

  // ==================== OIDC ====================

  // ==================== Push ====================
  // 这些类型在 SDK `@types/PushRules` 中已有规范定义，此处显式重声明以
  // 保证在本 augmentation 场景下（declare module 'matrix-js-sdk' 覆盖了
  // 主入口 export * 的部分解析）能被 `import { IPushRule } from 'matrix-js-sdk'`
  // 找到。字段形状与 SDK canonical（`default: boolean` required）保持一致。

  // Note: Push types exist in matrix-js-sdk/@types/PushRules.ts but are not exported from main index
  // We re-export them here for convenience

  // Note: ICreatePushRuleRequest 定义在 SDK `push/index.ts`（子路径导出），未上浮到顶层 index。
  // 此处显式重声明，使服务层可从顶层 matrix-js-sdk 导入，避免 SDK 边界策略的裸子路径导入违规。
  export interface ICreatePushRuleRequest {
    actions: PushRuleAction[]
    conditions?: PushRuleCondition[]
    pattern?: string
    before?: string
    after?: string
  }

  // ==================== Event 和 Timeline 类型 ====================
  // 这些类型已在 SDK 中正确定义，此处提供补充

  // 解密重试：SDK 的 `attemptDecryption(crypto: CryptoBackend, …)` 形参类型 `CryptoBackend`
  // 是 `@internal` 且未从主入口导出，而调用方（服务层）只能拿到 `client.getCrypto()`
  // 返回的 `CryptoApi`（更窄的公开接口）。此处追加一条以 `CryptoApi` 为形参的重载，
  // 避免调用侧使用 `as any` / `as unknown as` 绕过类型检查。
  interface MatrixEvent {
    attemptDecryption(
      crypto: CryptoApi,
      options?: {
        /** 是否 emit `MatrixEventEvent.Decrypted`，默认 true —— 重试后 store 依赖该事件回填 */
        emit?: boolean
        isRetry?: boolean
      }
    ): Promise<void>
  }

  // synapse-rust 特有：输入状态管理器扩展
  // 官方 matrix-js-sdk 不包含此管理器接口

  // synapse-rust 特有：已读回执管理器扩展
  // 官方 matrix-js-sdk 不包含此管理器接口

  // ==================== 错误和存储 ====================
  // MatrixClient 接口扩展

  // ==================== 子块文件 ====================
  // MatrixClient 方法面（234 行）→ `./sdk-augmentations/client.d.ts`
  // 成员/同步/关系/目录等纯类型 → `./sdk-augmentations/types.d.ts`
  // 两个文件各自声明 `declare module 'matrix-js-sdk'`，靠 TS 声明合并还原；
  // check-sdk-augmentations 已改为扫描本目录，判据覆盖不变。
}

// ==================== SDK 子路径模块类型声明 ====================
// 清单 D.3: 移除 10 个仅含 extendMatrixClient() 桩声明的 declare module 块。
// extendMatrixClient 在 tjg 生产代码中零引用（sdk-compat.ts 不导出该函数），
// 这些增强块全是死代码。其中 credentials/message/profile/sending 4 个子路径
// 在 SDK package.json exports 中不存在，属于幻影声明；其余 6 个（account/auth/
// capabilities/room/media/presence）SDK 已提供真实类型，删除增强后 TS 自动回退。
