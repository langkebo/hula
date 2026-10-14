/**
 * 现代 Web API 兼容层（P2-2 / 对应审查报告 CP-02、CP-03、CP-04）。
 *
 * TJG 运行在系统 WebView 中（macOS/iOS 为 WKWebView，Windows 为 WebView2，
 * Linux 为 WebKitGTK），构建目标为 `safari15` 一带，但 iOS 最低系统版本更低。
 * 以下运行时 API 在旧版 WebView 或非安全上下文下可能缺失，统一在此做特性检测
 * 与降级，避免运行期出现 `undefined is not a function` / `Cannot read properties
 * of undefined`：
 *   - `crypto.subtle`：仅安全上下文可用（`requireSubtleCrypto` 提供可读报错）
 *   - `crypto.randomUUID`：Safari 15.4+ / 安全上下文（`safeRandomUUID` 兜底为 v4）
 *   - `Object.hasOwn`：Safari 15.4+（`hasOwn` 回退 `hasOwnProperty`）
 *   - `Array.prototype.at`：Safari 15.4+（`arrayAt` 回退手工索引）
 */

import { bytesToHex } from '@/utils/StringUtils'

/** 判断当前环境是否提供 WebCrypto 的 SubtleCrypto 实现。 */
export function hasSubtleCrypto(): boolean {
  return typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.subtle !== 'undefined'
}

/**
 * 获取 SubtleCrypto 实例。
 *
 * @throws 当环境缺失 `crypto.subtle`（旧 WebView / 非安全上下文）时抛出可读错误，
 * 而非在调用点抛出难以定位的 `TypeError`。
 */
export function requireSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle
  if (!subtle) {
    throw new Error('当前环境不支持 WebCrypto SubtleCrypto（需要安全上下文或较新的 WebView）')
  }
  return subtle
}

/**
 * 生成 RFC 4122 v4 UUID。
 *
 * 优先使用原生 `crypto.randomUUID`；缺失时（旧 WebView / 非安全上下文）用
 * `crypto.getRandomValues` 生成等价格式，保证仍返回合法的 v4 UUID。
 */
export function safeRandomUUID(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16))
  // 按 RFC 4122 设置版本号（4）与变体位（10xx）
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytesToHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/**
 * `Object.hasOwn` 兼容实现。
 *
 * 旧 WebView 无 `Object.hasOwn` 时回退到 `Object.prototype.hasOwnProperty.call`，
 * 语义与原生一致（仅自有属性，不含原型链）。
 */
export function hasOwn(target: object, key: PropertyKey): boolean {
  if (typeof Object.hasOwn === 'function') {
    return Object.hasOwn(target, key)
  }
  // 降级路径必须落在原型方法上：旧 WebView 无 Object.hasOwn，此分支正是为它兜底。
  // biome-ignore lint/suspicious/noPrototypeBuiltins: 兼容旧 WebView 的必要回退
  return Object.prototype.hasOwnProperty.call(target, key)
}

/**
 * `Array.prototype.at` 兼容实现，支持负索引。
 *
 * 越界返回 `undefined`，与原生语义一致。
 */
export function arrayAt<T>(items: readonly T[], index: number): T | undefined {
  if (typeof items.at === 'function') {
    return items.at(index)
  }
  const { length } = items
  const normalized = index < 0 ? length + index : index
  if (normalized < 0 || normalized >= length) return undefined
  return items[normalized]
}
