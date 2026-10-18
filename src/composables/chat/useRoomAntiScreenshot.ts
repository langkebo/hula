import { type Ref, ref, watch } from 'vue'
import { matrixRoomAccountDataService } from '@/services/matrix/room/AccountDataService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomAntiScreenshot')

export interface UseRoomAntiScreenshotReturn {
  /** 房间是否启用了防截屏标记（`com.hula.privacy` 的 `action: block_screenshot`） */
  enabled: Ref<boolean>
  /** 正在读取/写入 */
  loading: Ref<boolean>
  /** 最近一次读写失败（读失败时 `enabled` 为 false，见下方说明） */
  error: Ref<unknown>
  refresh: () => Promise<void>
  setEnabled: (next: boolean) => Promise<boolean>
}

/**
 * 房间级「防截屏」标记的读取与写入（F-2）。
 *
 * 事实边界（写进 UI 文案时必须一致）：
 * - 这个标记只会让客户端**打水印警示**，**不能阻止**任何截屏/录屏工具；
 * - 服务端只存一个房间状态事件，无法验证客户端是否真的执行。
 *
 * 失败方向：
 * - **读**失败 → `enabled=false`（宁可不显示水印，也不谎称已在保护）并置 `error`；
 * - **写**失败 → 回滚乐观更新，并把错误抛回调用方，由 UI 提示。
 *
 * @param roomId 当前房间。为空时不做任何请求（并复位状态）。
 */
export function useRoomAntiScreenshot(roomId: Ref<string | null | undefined>): UseRoomAntiScreenshotReturn {
  const enabled = ref(false)
  const loading = ref(false)
  const error = ref<unknown>(null)

  async function refresh(): Promise<void> {
    const id = roomId.value
    if (!id) {
      enabled.value = false
      error.value = null
      return
    }

    loading.value = true
    try {
      const result = await matrixRoomAccountDataService.getAntiScreenshot(id)
      enabled.value = result.enabled === true
      error.value = null
    } catch (err) {
      // 服务层目前是 fail-soft（内部 catch 后返回 enabled:false），
      // 这里再兜一层是为了将来它改成 throw 时行为不变。
      enabled.value = false
      error.value = err
      logger.warn(`读取防截屏标记失败，按「未启用」处理: ${id}, err=${err}`)
    } finally {
      loading.value = false
    }
  }

  async function setEnabled(next: boolean): Promise<boolean> {
    const id = roomId.value
    if (!id) return false

    const previous = enabled.value
    enabled.value = next // 乐观更新：开关立刻响应
    loading.value = true
    try {
      await matrixRoomAccountDataService.setAntiScreenshot(id, next)
      error.value = null
      return true
    } catch (err) {
      enabled.value = previous // 回滚：不能让 UI 显示一个服务端没接受的设置
      error.value = err
      logger.error(`设置防截屏标记失败，已回滚: ${id}, enabled=${next}, err=${err}`)
      return false
    } finally {
      loading.value = false
    }
  }

  watch(roomId, () => {
    void refresh()
  })

  return { enabled, loading, error, refresh, setEnabled }
}
