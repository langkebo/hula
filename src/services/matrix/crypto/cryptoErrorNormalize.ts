/**
 * Crypto 错误归一化（从 `MatrixCryptoStateTracker` 抽出，Batch 4.2）。
 *
 * 背景：WASM（`@matrix-org/matrix-sdk-crypto-wasm`）在 `OlmMachine.initFromStore`
 * 或 `StoreHandle.open` 失败时，通过 wasm-bindgen 抛出的错误往往是**空对象 `{}`**，
 * 既不是 Error 实例、也没有 `message` 属性。直接 `String({})` 会得到 `"[object Object]"`，
 * 于是**按错误字符串匹配的清理重试分支会被整段跳过**（历史 BUG：高版本 store 无法打开时
 * 每次都静默降级为非加密模式）。
 *
 * 不依赖 `matrix-js-sdk`，故不受 `check:sdk-boundary` 约束。
 */

/**
 * 把 catch 块捕获到的错误对象归一化为可读字符串。
 *
 * 归一化策略：
 *   - Error 实例 → `err.message`
 *   - 非空对象 → `JSON.stringify`（成功且非空结构）；`{}` → `'[empty-object]'`；
 *     stringify 失败 → `String(err)`
 *   - 其他基本类型 → `String(err)`
 *
 * @returns 可读的错误消息字符串（可能为空字符串）
 */
export function normalizeCryptoError(err: unknown): string {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === 'object' && err !== null) {
    // 优先 JSON.stringify（可捕获空对象 {}、含字段的普通对象）
    try {
      const json = JSON.stringify(err)
      // JSON.stringify({}) === "{}" 等空结构，仍返回以便上层匹配
      return json && json !== '{}' ? json : '[empty-object]'
    } catch {
      return String(err)
    }
  }
  return String(err)
}
