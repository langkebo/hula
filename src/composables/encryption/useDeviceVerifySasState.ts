import { computed, type Ref, ref } from 'vue'

/** 单个 emoji 比对项（m.sas.v1 的 7 项之一）。 */
interface SasEmoji {
  emoji: string
  description: string
}

/** SDK 侧 SAS 视图（只取本 composable 需要的字段）。 */
interface SasViewSnapshot {
  emoji: ReadonlyArray<readonly [string, string]>
  decimal: readonly number[] | null
}

interface UseDeviceVerifySasStateOptions {
  /** 等待 SAS 就绪（对端接受后才产生），必须抛错而不是返回空值。 */
  waitForSasView: (transactionId: string, options?: { shouldAbort?: () => boolean }) => Promise<SasViewSnapshot>
  /** 拿不到 SAS 时的回调（由调用方决定提示文案与目标步骤）。 */
  onUnavailable: () => void
}

/**
 * SAS 比对状态机（PC 端设备验证用）。
 *
 * 单独成模块的两个原因：
 * 1. `useDeviceVerifyDialog.ts` 已贴着体积基线，不宜再长；
 * 2. 这段逻辑是**安全边界**，独立后可以只测它，不必挂整个对话框。
 *
 * 核心不变量：`sasReady` 为 false 时 `canConfirm` 恒 false —— 没有真实 SAS 就不可确认。
 */
export function useDeviceVerifySasState({ waitForSasView, onUnavailable }: UseDeviceVerifySasStateOptions) {
  const sasReady = ref(false)
  const sasEmojis: Ref<SasEmoji[]> = ref([])
  const sasDecimal = ref<number[]>([])
  /** 用户是否勾选「以上 emoji 与对方设备一致」——唯一的确认前提。 */
  const sasConfirmed = ref(false)

  const canConfirm = computed(() => sasReady.value && sasConfirmed.value)

  function reset(): void {
    sasReady.value = false
    sasEmojis.value = []
    sasDecimal.value = []
    sasConfirmed.value = false
  }

  /**
   * 等待并载入 SAS。
   *
   * @param transactionId 事务 id
   * @param isCurrent 判断该事务是否仍是当前事务（用户取消/关闭后结果应丢弃）
   * @returns 是否成功载入
   */
  async function load(transactionId: string, isCurrent: () => boolean): Promise<boolean> {
    reset()
    try {
      const view = await waitForSasView(transactionId, { shouldAbort: () => !isCurrent() })
      if (!isCurrent()) return false
      sasEmojis.value = view.emoji.map(([emoji, name]) => ({ emoji, description: name }))
      sasDecimal.value = view.decimal ? [...view.decimal] : []
      sasReady.value = true
      return true
    } catch {
      // 用户已取消/关闭：静默丢弃，不要把界面推到失败态
      if (!isCurrent()) return false
      onUnavailable()
      return false
    }
  }

  return { sasReady, sasEmojis, sasDecimal, sasConfirmed, canConfirm, reset, load }
}
