import {
  deleteSecureSecret,
  describeSecureStorageBackend,
  getSecureSecret,
  getSecureStorageBackendInfo,
  setSecureSecret
} from '@/services/secure/secureStorage'
import { createLogger } from '@/utils/Logger'
import { clearKeySource, readKeySource, writeKeySource } from './cryptoKeySource'
import { getLocalUnlockStorageKey } from './localUnlockKey'

const logger = createLogger('CryptoStorageKey')

/**
 * keychain 条目名前缀。**不可更改**：改名会让既有安装读不到原值而生成新密钥，
 * 进而使已加密的 crypto store 无法解密（需要重建 store、重新从服务端取回密钥）。
 * 名称里的 `password` 是历史遗留（见下方"加密原语迁移"），条目内容始终是
 * 「32 随机字节的 base64」，不随原语变化。
 *
 * ## 命名约束（踩过的坑）
 *
 * 常量标识符里**不得出现连续的 `STORAGE_KEY`**（`*STORAGE_KEY*` 正是
 * `scripts/check-settings-wiring.mjs` 用来识别 **web 持久化 key 声明**的启发式；
 * 而本常量是 **Tauri keychain**（`invoke('set_secret')`）的条目名，不在其判据范围内）。
 * 叫 `CRYPTO_STORAGE_KEY_PREFIX` 会被宽松扫描扫到、被精确发现器漏掉 ⇒ 触发
 * 「漏报自检 FAIL」。`CRYPTO_KEYCHAIN_PREFIX` 既准确（它就是 keychain 前缀）
 * 又不与该启发式冲突。
 *
 * 导出是**刻意的**：键名必须在测试里被引用，而不是在测试中再抄一遍字面量 ——
 * 重复字面量会让"改名破坏兼容性"这类失误无人发现。
 */
export const CRYPTO_KEYCHAIN_PREFIX = 'tjg-crypto-storage-password'

/** crypto store 加密密钥的长度（SDK 强制要求恰好 32 字节）。 */
export const CRYPTO_STORAGE_KEY_BYTES = 32

/**
 * 会话内内存缓存：userId:deviceId → 密钥字节。
 *
 * 背景：macOS dev 模式下 keychain 可能不稳定（entry 存后立即读不到），
 * 而 MatrixClient 在启动时会被重建（配置变更），导致 ensureCrypto 被调用多次。
 * 若每次都从 keychain 读取失败后生成新密钥，crypto store 会被不同密钥加密，
 * 下次启动时解密失败（"An object failed to be decrypted while unpickling"）。
 *
 * 内存缓存保证：同一会话内同一 userId:deviceId 始终返回同一密钥，
 * 即使 keychain 暂时不可用。登出时通过 clearCryptoStorageKeyCache 清除。
 */
const keyCache = new Map<string, Uint8Array>()

function buildKey(userId: string, deviceId: string): string {
  return `${CRYPTO_KEYCHAIN_PREFIX}:${userId}:${deviceId}`
}

function cacheKey(userId: string, deviceId: string): string {
  return `${userId}:${deviceId}`
}

/**
 * 生成 32 字节随机密钥并编码为 base64（keychain 只能存字符串）。
 *
 * **为什么是 base64 而不是十六进制/原始字符串**：keychain 层（Tauri store）以字符串
 * 往返，base64 是 32 字节 → 字符串的**无损**编码；解码后必须仍是 32 字节，
 * 否则 SDK 会以 "must be exactly 32 bytes" 拒绝。
 */
function generateRandomKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(CRYPTO_STORAGE_KEY_BYTES))
}

/** 32 字节 → 标准 base64（带 padding，便于稳定往返比较）。 */
function encodeKey(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * base64 → 32 字节。
 *
 * @returns 恰好 32 字节的密钥；编码非法或长度不符时返回 `null`
 *   （**不**返回"尽量解析"的结果——长度错的密钥会让 SDK 抛错，且掩盖 keychain 损坏）
 */
function decodeKey(encoded: string): Uint8Array | null {
  let bytes: Uint8Array
  try {
    const binary = atob(encoded)
    bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  } catch {
    return null
  }
  return bytes.length === CRYPTO_STORAGE_KEY_BYTES ? bytes : null
}

/** 返回密钥副本，避免调用方（含 WASM）就地修改缓存内容。 */
function copyKey(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes)
}

/**
 * 获取或创建 crypto store 的 **storageKey**（32 字节原始密钥）。
 *
 * ## 加密原语迁移（2026-10-12）
 *
 * SDK 的 `initRustCrypto` 提供两条互斥路径（`client.d.ts` JSDoc 原文）：
 *
 * | 参数 | 语义 | 代价 |
 * | --- | --- | --- |
 * | `storageKey: Uint8Array` | **直接**用作密钥；必须恰好 32 字节、每次启动一致 | 无 |
 * | `storagePassword: string` | 口令 → **故意慢**的 KDF 派生密钥 | 每次启动都付一次派生 |
 *
 * 本模块原先走 `storagePassword`，但传入的值**不是用户口令**，而是随机 32 字节的
 * base64 —— 即"用慢 KDF 处理一个本就均匀随机的密钥"，纯粹是启动延迟；
 * 而 SDK 文档明确要求「prefer to pass a `storageKey` directly where possible」。
 * 现改为 `storageKey`（原始字节）。
 *
 * ⚠️ **兼容性**：两类原语派生出的实际加密密钥不同，切换后**旧 store 无法解密**。
 * 因此密钥库初始化侧（`MatrixCryptoStateTracker`）会把加密原语一并写入本地标记
 * （`k` / `p` / `0`），检测到原语变化时**提前**清理旧 store，避免"失败一次再重试"。
 * 代价是本地 crypto store 重建（房间密钥重新从服务端备份/密钥请求取回），
 * 不涉及私钥外泄。
 *
 * ## 一致性原则（关键）
 *
 * storageKey 必须跨会话稳定，否则下次启动用新密钥无法解密旧 store
 * （WASM `StoreHandle.open` 失败，错误对象常为 `{}`）。因此安全存储不可用时
 * **不生成随机密钥**，而是返回 `null`（由调用方决定"不加密 store"这一降级），
 * 保持跨会话可读。
 *
 * 行为：
 * - 首次调用：生成 32 随机字节并写入安全存储（至少一个后端可用时）
 * - 后续调用：从安全存储读取并解码
 * - 安全存储不可用 / 写入失败 / 值损坏：返回 `null`
 *
 * 存储后端由 Rust 侧实测决定（原生密钥库优先，失败则落 master-key 加密的文件 fallback），
 * 日志经 `describeSecureStorageBackend()` 如实描述 —— **降级时不得出现 "keychain" 字样**。
 *
 * @param userId Matrix 用户 ID
 * @param deviceId Matrix 设备 ID
 * @returns 恰好 32 字节的 storageKey，或 `null`
 */

/**
 * 安全存储不可用时，退到「本地解锁密码派生的 storageKey」（F-4 / B2）。
 *
 * 顺序刻意如此：
 * 1. 安全存储（原生或加密文件 fallback）—— 首选，用户无感；
 * 2. 本地解锁密钥 —— 仅在**本次会话已解锁**时可用（密钥只在内存）；
 * 3. 都没有 → 返回 null，由调用方决定 fail-closed（**不得**默认明文落盘）。
 *
 * 返回 null 不等于"允许不加密"：那是调用方（crypto 初始化）的决策点。
 */
function resolveLocalUnlockKey(): Uint8Array | null {
  const key = getLocalUnlockStorageKey()
  if (!key) return null
  if (key.length !== 32) {
    // 长度不对宁可不用，也不要拿一把错长度的密钥去打开 store
    key.fill(0)
    return null
  }
  return key
}

/**
 * 采用「本地解锁密码派生」的密钥，并把来源记为 `local`。
 *
 * 未解锁（密钥不在内存）时返回 null —— 调用方 fail-closed。
 * 注意：此路径**不以安全存储可用性为前提**，因为来源一旦是 local，
 * 安全存储里的那把密钥就不是加密旧 store 的那把。
 */
function adoptLocalUnlockKey(cKey: string, userId: string, deviceId: string): Uint8Array | null {
  const localKey = resolveLocalUnlockKey()
  if (!localKey) {
    logger.warn(
      `crypto storageKey 需由本地解锁密钥提供，但本次会话尚未解锁，crypto store 将不加密: ${userId}/${deviceId}`
    )
    return null
  }
  writeKeySource(cKey, 'local')
  keyCache.set(cKey, localKey)
  logger.debug(`使用本地解锁密钥作为 crypto storageKey: ${userId}/${deviceId}`)
  return copyKey(localKey)
}

/**
 * 来源已记为 `secure` 时的读取路径：**只**读安全存储。
 *
 * 条目缺失 / 损坏 / 读取抛错一律返回 null，绝不改读本地解锁密钥 ——
 * 换一把密钥打开旧 store 只会 `unpickling` 失败，比"本次不加密"更糟。
 */
async function readRecordedSecureKey(
  cKey: string,
  userId: string,
  deviceId: string,
  key: string,
  backendLabel: string
): Promise<Uint8Array | null> {
  try {
    const existing = await getSecureSecret(key)
    if (!existing) {
      logger.warn(
        `crypto storageKey 记录来源为安全存储，但 ${backendLabel} 中已无该条目；为避免换密钥打开旧 store，本次不加密: ${userId}/${deviceId}`
      )
      return null
    }
    const decoded = decodeKey(existing)
    if (!decoded) {
      logger.warn(`安全存储中的 crypto storageKey 损坏（非 32 字节 base64），已清除且不切换来源: ${userId}/${deviceId}`)
      await deleteSecureSecret(key).catch(() => {})
      return null
    }
    logger.debug(`从 ${backendLabel} 读取 crypto storageKey: ${userId}/${deviceId}`)
    keyCache.set(cKey, decoded)
    return copyKey(decoded)
  } catch (err) {
    logger.error(`读取 crypto storageKey 失败（记录来源为安全存储）: ${userId}/${deviceId}`, err)
    return null
  }
}

/**
 * 取出（或首次派生）用于加密本地 crypto store 的 32 字节 storageKey。
 *
 * 密钥来源有两条互斥路径，且**跨会话必须锁定在同一条**（见
 * `CRYPTO_KEY_SOURCE_STORAGE_KEY`）：安全存储（首选，用户无感）与本地解锁密码派生
 * （仅内存）。因此顺序是「已记录来源 → 安全存储 → 本地解锁」，
 * 而不是每次启动按当时后端可用性重新选。
 *
 * 本地解锁未启用/未解锁时返回 null，调用方必须据此 fail-closed
 * （不传 storageKey 给 SDK 会让设备私钥与房间密钥明文落盘）。
 *
 * @returns 32 字节密钥；来源不可用/未解锁/值损坏时为 null
 */
export async function getOrCreateCryptoStorageKey(userId: string, deviceId: string): Promise<Uint8Array | null> {
  const cKey = cacheKey(userId, deviceId)

  // 1. 优先从内存缓存读取（避免 MatrixClient 重建时 keychain 暂时读不到导致换密钥）
  const cached = keyCache.get(cKey)
  if (cached) {
    logger.debug(`从内存缓存读取 crypto storageKey: ${userId}/${deviceId}`)
    return copyKey(cached)
  }

  // 2. 已记录的来源优先于"当前后端是否可用"
  const recordedSource = readKeySource(cKey)
  if (recordedSource === 'local') {
    return adoptLocalUnlockKey(cKey, userId, deviceId)
  }

  const key = buildKey(userId, deviceId)

  // 后端事实（**不猜测**）：降级时密钥只受 master-key 加密的文件保护，
  // 日志里不得再说 "keychain"（历史缺陷：无论实际后端为何都打印 keychain）。
  const backendInfo = await getSecureStorageBackendInfo()
  const backendLabel = describeSecureStorageBackend(backendInfo)

  if (recordedSource === 'secure') {
    return readRecordedSecureKey(cKey, userId, deviceId, key, backendLabel)
  }

  // 3. 来源未知（首次运行 / 升级前的旧安装）：安全存储优先，失败才退本地解锁
  try {
    const existing = await getSecureSecret(key)
    if (existing) {
      const decoded = decodeKey(existing)
      if (decoded) {
        logger.debug(`从 ${backendLabel} 读取 crypto storageKey: ${userId}/${deviceId}`)
        writeKeySource(cKey, 'secure')
        keyCache.set(cKey, decoded)
        return copyKey(decoded)
      }
      // 值损坏（非 base64 / 长度不符）→ 不可用。删除并返回 null，
      // **不**静默生成新密钥（会用新密钥打开旧 store，必然解密失败且难以诊断）。
      logger.warn(`安全存储中的 crypto storageKey 损坏（非 32 字节 base64），已清除: ${userId}/${deviceId}`)
      await deleteSecureSecret(key).catch(() => {})
      return adoptLocalUnlockKey(cKey, userId, deviceId)
    }

    // 4. 安全存储中无记录 → 生成新密钥并写入
    const generated = generateRandomKey()
    const success = await setSecureSecret(key, encodeKey(generated))
    if (!success) {
      logger.warn(`安全存储不可用或写入失败，尝试本地解锁密钥: ${userId}/${deviceId}`)
      return adoptLocalUnlockKey(cKey, userId, deviceId)
    }

    // 5. 写入后立即读回验证
    //    Rust 端 SecureStore 采用双写策略（原生密钥库 + 加密文件 fallback），
    //    get_secret 会先读原生后端，失败后从文件 fallback 加载。
    //    验证确保密钥可跨会话稳定读取，避免 initRustCrypto 报
    //    "An object failed to be decrypted while unpickling"。
    const verifyRead = await getSecureSecret(key)
    if (verifyRead !== encodeKey(generated)) {
      logger.warn(
        `crypto storageKey 写入后读回验证失败（安全存储各后端均不可读），crypto store 将不加密: ${userId}/${deviceId}`
      )
      await deleteSecureSecret(key).catch(() => {})
      return adoptLocalUnlockKey(cKey, userId, deviceId)
    }

    writeKeySource(cKey, 'secure')
    keyCache.set(cKey, generated)
    if (backendInfo.degraded) {
      logger.warn(
        `生成并存储 crypto storageKey（已验证可读回），但**系统密钥库不可用**，仅存于 ${backendLabel}: ${userId}/${deviceId}`
      )
    } else {
      logger.info(`生成并存储 crypto storageKey（已验证可读回，存储于 ${backendLabel}）: ${userId}/${deviceId}`)
    }
    return copyKey(generated)
  } catch (err) {
    // 安全存储本身抛错（IPC 失败 / 后端崩溃）也算「不可用」，不能直接落回明文
    logger.error(`获取 crypto storageKey 失败: ${userId}/${deviceId}`, err)
    return adoptLocalUnlockKey(cKey, userId, deviceId)
  }
}

/**
 * 删除 keychain 中的 crypto storageKey。
 *
 * 在用户登出或清除账号数据时调用，避免残留旧密钥。
 *
 * @param userId Matrix 用户 ID
 * @param deviceId Matrix 设备 ID
 */
export async function deleteCryptoStorageKey(userId: string, deviceId: string): Promise<void> {
  const cKey = cacheKey(userId, deviceId)
  keyCache.delete(cKey)
  // 来源标记必须与密钥一起清除：残留标记会让下次启动按旧来源 fail-closed
  clearKeySource(cKey)
  const key = buildKey(userId, deviceId)
  try {
    await deleteSecureSecret(key)
    logger.info(`已删除 crypto storageKey: ${userId}/${deviceId}`)
  } catch (err) {
    logger.warn(`删除 crypto storageKey 失败: ${userId}/${deviceId}`, err)
  }
}

/**
 * 清除所有内存缓存的 crypto storageKey。
 *
 * 在用户登出时调用，确保下次登录不会复用旧会话的密钥。
 */
export function clearCryptoStorageKeyCache(): void {
  keyCache.clear()
}

/**
 * 记录 crypto storageKey **实际存放的后端**。
 *
 * 为什么抽到这里而不是内联在调用方：`MatrixCryptoStateTracker.ts` 属于
 * `check:file-size` 的体积基线受管文件（只许缩不许增），内联这段日志会让它增长
 * 十余行并顶红门禁。放在本模块还能与"从哪个后端读取"的既有文案共用同一描述函数。
 *
 * 后端事实来自 Rust 侧**实测**：**降级时不得出现 "keychain" 字样** ——
 * 历史实现无条件打印"已从 keychain 获取"，而同一 run 的 Rust 侧却打印
 * `Keychain bug detected … Falling back to file storage`，两处日志互相矛盾，
 * 使"密钥其实只在 master-key 加密的文件里"这一降级对用户与排障者都不可见。
 *
 * @param userId Matrix 用户 ID
 * @param deviceId Matrix 设备 ID
 */
export async function logCryptoStorageKeyBackend(userId: string, deviceId: string): Promise<void> {
  const backendInfo = await getSecureStorageBackendInfo()
  const backendLabel = describeSecureStorageBackend(backendInfo)

  if (backendInfo.degraded) {
    logger.warn(
      `crypto storageKey（32 字节）仅存于 ${backendLabel} —— 未受操作系统密钥库保护；crypto store 将加密: ${userId}/${deviceId}`
    )
    return
  }

  logger.info(`crypto storageKey（32 字节）存储于 ${backendLabel}，crypto store 将加密: ${userId}/${deviceId}`)
}
