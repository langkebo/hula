import { computed, ref } from 'vue'
import { configureLocalUnlock, isLocalUnlockConfigured, unlockLocalUnlock } from '@/services/secure/localUnlockKey'
import { getSecureStorageBackendInfo } from '@/services/secure/secureStorage'
import { hasTauriRuntime } from '@/utils/AppHarness'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('LocalUnlockGate')

/** 密码最小长度：与私密聊天保持一致，避免同一批用户遇到两套规则 */
export const LOCAL_UNLOCK_MIN_PASSWORD_LENGTH = 6

/**
 * 本地解锁门禁（F-4 / B1 的「给人一条出路」那一半）。
 *
 * ## 为什么门禁必须在 crypto 初始化**之前**
 *
 * `getOrCreateCryptoStorageKey()` 会在 crypto 初始化时读一次密钥。
 * 只要用户在那之前完成解锁，key 就在内存里，初始化就能加密打开 store ——
 * **完全不需要「解锁后重新 init crypto」**（那条路要绕过 crypto 生命周期守卫，风险高得多）。
 *
 * ## 状态放在模块级
 *
 * App.vue 负责触发 `ensureReady()`，对话框组件负责渲染；
 * 两者必须是同一份状态，否则会出现「对话框没弹但流程在等」的挂死。
 */
const visible = ref(false)
const mode = ref<'setup' | 'unlock'>('setup')
const submitting = ref(false)
const errorKey = ref<string | null>(null)

let resolvePending: ((ready: boolean) => void) | null = null

function settle(ready: boolean): void {
  visible.value = false
  submitting.value = false
  errorKey.value = null
  const resolve = resolvePending
  resolvePending = null
  resolve?.(ready)
}

export function useLocalUnlockGate() {
  const needsConfigure = computed(() => mode.value === 'setup')

  /**
   * 在 crypto 初始化前确保「要么安全存储可用，要么用户提供了本地解锁密码」。
   *
   * @returns `true` = 可以继续启动；`false` = 用户选择稍后（crypto 将 fail-closed，
   *          本次会话 E2EE 不可用，但**不会**把私钥写成明文）
   */
  async function ensureReady(): Promise<boolean> {
    // 浏览器 / 非 Tauri 宿主（含 `pnpm dev`）既没有安全存储也没有 E2EE，
    // 门禁无从保护任何东西；若在此等待交互，启动 splash（z-index 9999）
    // 会盖住对话框，形成「门禁等点击、bootstrap 等门禁、splash 等 bootstrap」的死锁。
    if (!hasTauriRuntime()) {
      logger.info('非 Tauri 运行时，跳过本地解锁门禁')
      return true
    }

    let info = null
    try {
      info = await getSecureStorageBackendInfo()
    } catch (err) {
      logger.warn('读取安全存储状态失败，按不可用处理:', err)
    }

    if (info?.available && !isLocalUnlockConfigured()) {
      // 原生或加密文件 fallback 均可用，且用户从未设置本地解锁 —— 无需打扰用户
      return true
    }

    // 已配置本地解锁时必须进入解锁流程，**即使安全存储当前可用**：
    // crypto storageKey 可能来自上一次的本地解锁（当时安全存储不可用），
    // 而未解锁时该密钥不在内存，直接放行会让 crypto 初始化拿不到正确密钥而 fail-closed
    // （症状：冷启动直接进会话页，但 E2EE 不可用）。
    mode.value = isLocalUnlockConfigured() ? 'unlock' : 'setup'
    errorKey.value = null
    visible.value = true
    return await new Promise<boolean>((resolve) => {
      resolvePending = resolve
    })
  }

  /** 提交密码（设置或解锁）。成功即关闭对话框并放行启动。 */
  async function submit(password: string): Promise<boolean> {
    if (submitting.value) return false
    errorKey.value = null

    if (password.length < LOCAL_UNLOCK_MIN_PASSWORD_LENGTH) {
      errorKey.value = 'setting.security.local_unlock_too_short'
      return false
    }

    submitting.value = true
    try {
      if (mode.value === 'setup') {
        await configureLocalUnlock(password)
        logger.info('本地解锁密码已设置')
        settle(true)
        return true
      }

      const ok = await unlockLocalUnlock(password)
      if (!ok) {
        errorKey.value = 'setting.security.local_unlock_wrong_password'
        submitting.value = false
        return false
      }
      settle(true)
      return true
    } catch (err) {
      logger.error('本地解锁失败:', err)
      errorKey.value = 'setting.security.local_unlock_failed'
      submitting.value = false
      return false
    }
  }

  /** 用户选择「稍后」：放行启动，但 crypto 会 fail-closed */
  function skip(): void {
    logger.warn('用户跳过本地解锁，本次会话加密功能不可用（不会写明文密钥）')
    settle(false)
  }

  return {
    visible,
    mode,
    submitting,
    errorKey,
    needsConfigure,
    ensureReady,
    submit,
    skip
  }
}

/** 仅供测试：重置模块级状态 */
export function resetLocalUnlockGateForTest(): void {
  visible.value = false
  mode.value = 'setup'
  submitting.value = false
  errorKey.value = null
  resolvePending = null
}

/**
 * 启动前置：本地解锁门禁。
 *
 * **必须在 crypto 初始化之前**调用 —— 解锁后密钥已在内存，初始化即可加密打开 store，
 * 因此不需要「解锁后再重新 init」（那条路要绕 crypto 生命周期守卫，风险高得多）。
 *
 * 用户选择「稍后」时返回 false：启动继续，但 MatrixCryptoStateTracker 会 fail-closed
 * （不写明文），代价是本次会话 E2EE 不可用。
 *
 * @returns 是否已就绪（false = 用户选择稍后 / 安全存储不可用且未设置密码）
 */
export async function runLocalUnlockPreflight(): Promise<boolean> {
  return useLocalUnlockGate().ensureReady()
}
