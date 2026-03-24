/**
 * 通用类型映射 - 替代部分 any
 */

// ==================== 基础类型映射 ====================

/** 任意值 */
export type Any = unknown

/** 任意对象 */
export type AnyObject = Record<string, unknown>

/** 任意函数 */
export type AnyFunction = (...args: any[]) => any

/** 任意数组 */
export type AnyArray = unknown[]

/** Promise 类型 */
export type AnyPromise<T = unknown> = Promise<T>

// ==================== Vue/React 相关 ====================

/** Vue 组件 props - 简化版本 */
export type ComponentProps<T> = T extends { $props: infer P } ? P : Partial<T>

/** Vue 组件 emit */
export type ComponentEmits<T> = T extends { $emit: (event: infer E, ...args: any[]) => void } ? E : never

/** Vue ref 类型 */
export type VueRef<T> = import('vue').Ref<T>

// ==================== Matrix 相关 ====================

/** Matrix 事件内容 */
export type MatrixEventContent = Record<string, unknown>

/** Matrix 房间成员 */
export type MatrixRoomMember = {
  userId: string
  displayName?: string
  avatarUrl?: string
  membership?: string
}

/** Matrix 房间信息 */
export type MatrixRoomInfo = {
  roomId: string
  name?: string
  topic?: string
  avatarUrl?: string
  memberCount?: number
  isDirect?: boolean
}

/** Matrix 消息内容 */
export type MatrixMessageContent = {
  msgtype: string
  body: string
  url?: string
  info?: Record<string, unknown>
  'm.relates_to'?: Record<string, unknown>
}

// ==================== API 响应 ====================

/** 通用 API 响应 */
export type ApiResponse<T = unknown> = {
  code: number
  message?: string
  data?: T
  error?: string
}

/** 分页响应 */
export type PaginatedResponse<T> = {
  list: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/** 分页请求参数 */
export type PaginatedRequest = {
  page?: number
  pageSize?: number
  offset?: number
  limit?: number
}

// ==================== 事件系统 ====================

/** 事件监听器 */
export type EventListener<T = unknown> = (data: T) => void

/** 事件发射器 */
export type EventEmitter<T = unknown> = {
  on(event: string, listener: EventListener<T>): void
  off(event: string, listener: EventListener<T>): void
  emit(event: string, data: T): void
  once(event: string, listener: EventListener<T>): void
}

// ==================== 存储 ====================

/** 本地存储项 */
export type StorageItem<T = unknown> = {
  key: string
  value: T
  expiresAt?: number
}

/** 缓存项 */
export type CacheItem<T = unknown> = {
  data: T
  timestamp: number
  ttl?: number
}

// ==================== 工具类型 ====================

/** 可选属性 */
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

/** 必需属性 */
export type RequiredKey<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>

/** 只读类型 */
export type Readonly<T> = {
  readonly [P in keyof T]: T[P]
}

/** 可读可写类型 */
export type Writable<T> = {
  -readonly [P in keyof T]: T[P]
}

/** 深度只读 */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly U[]
  : T extends object
    ? { readonly [P in keyof T]: DeepReadonly<T[P]> }
    : T

/** 深度可选 */
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

/** 函数参数 */
export type Arguments<T extends AnyFunction> = T extends (...args: infer A) => any ? A : never

/** 函数返回值 */
export type ReturnType<T extends AnyFunction> = T extends (...args: any) => infer R ? R : never

// ==================== UI 相关 ====================

/** 下拉选项 */
export interface SelectOption<T = string> {
  label: string
  value: T
  disabled?: boolean
  icon?: string
  children?: SelectOption<T>[]
}

/** 表格列 */
export interface TableColumn<T = AnyObject> {
  key: string
  title: string
  width?: number
  align?: 'left' | 'center' | 'right'
  fixed?: 'left' | 'right'
  render?: (row: T, index: number) => unknown
}

/** 分页配置 */
export interface PaginationConfig {
  current: number
  pageSize: number
  total: number
  showSizeChanger?: boolean
  showQuickJumper?: boolean
  pageSizeOptions?: number[]
}

/** 弹窗配置 */
export interface ModalConfig {
  title?: string
  width?: number | string
  maskClosable?: boolean
  closable?: boolean
  footer?: boolean
  okText?: string
  cancelText?: string
}

// ==================== 表单相关 ====================

/** 表单字段 */
export interface FormField<T = unknown> {
  name: string
  label?: string
  value?: T
  rules?: ((value: T) => boolean | string)[]
  placeholder?: string
  disabled?: boolean
}

/** 表单数据 */
export type FormData = Record<string, unknown>

/** 表单验证结果 */
export interface FormValidationResult {
  valid: boolean
  errors: Record<string, string>
}

// ==================== 错误处理 ====================

/** 错误类型 */
export interface ErrorInfo {
  code?: string | number
  message: string
  details?: unknown
}

/** 错误边界 */
export interface ErrorBoundary {
  error: Error | null
  errorInfo?: string
  hasError: boolean
  resetError: () => void
}
