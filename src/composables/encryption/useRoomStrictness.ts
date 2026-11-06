import { type ComputedRef, computed, type MaybeRefOrGetter, type Ref, ref, toValue, watch } from 'vue'
import { useEncryption } from '@/composables/encryption/useEncryption'
import { applyGlobalStrict, applyRoomStrict } from '@/services/matrix/crypto/strictDevicePolicy'
import { useSettingStore } from '@/stores/domains/settings/setting'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('RoomStrictness')

/** 权威查询的状态：`ready` 才代表 `unverifiedCount` 可信 */
type RoomStrictnessStatus = 'idle' | 'loading' | 'ready' | 'failed'

interface UseRoomStrictnessReturn {
  /** 未验证设备台数；`null` = 尚未取到（见 `status`） */
  unverifiedCount: Ref<number | null>
  status: Ref<RoomStrictnessStatus>
  /** 本房间是否已启用严格模式（房间覆盖 或 全局） */
  strictActive: ComputedRef<boolean>
  /** 房间级覆盖：`true` 已开启；`null` 未设置（跟随全局） */
  roomOverride: ComputedRef<boolean | null>
  /** 全局严格模式（持久化偏好） */
  globalStrict: ComputedRef<boolean>
  /** 重新做一次权威查询 */
  refresh: () => Promise<void>
  /** 开启/关闭本房间的严格模式（持久化 + 立即施加到 SDK） */
  setRoomStrict: (strict: boolean) => void
  /** 开启/关闭全局严格模式（持久化 + 立即施加到 SDK） */
  setGlobalStrict: (enabled: boolean) => void
}

/**
 * 加密房间「未验证设备」策略（R-1）。
 *
 * 两层信息：
 * 1. **权威计数** —— `CryptoApi` 的 `getUnverifiedDevicesInRoom(roomId)`。
 *    该实现（`CryptoDeviceAdapter`）在**房间不在本地 store 时抛错**，
 *    因此这里必须把"失败"与"0 台"分开：`status === 'failed'` 时
 *    `unverifiedCount` 保持 `null`，UI 不得显示"本房间设备都已验证"。
 * 2. **用户决定** —— 严格模式（房间覆盖 / 全局）。默认全关（互操作默认）；
 *    决定持久化在 `useSettingStore.preferences`，因为
 *    `Room.setBlacklistUnverifiedDevices()` 只写内存、不持久化。
 *
 * @param roomId 当前房间 ID（可为 `null`：此时不做查询，计数为 `null`）
 */
export function useRoomStrictness(roomId: MaybeRefOrGetter<string | null>): UseRoomStrictnessReturn {
  const settingStore = useSettingStore()
  const { getUnverifiedDevicesInRoom } = useEncryption()

  const unverifiedCount = ref<number | null>(null)
  const status = ref<RoomStrictnessStatus>('idle')

  const currentRoomId = computed(() => toValue(roomId) || null)
  const roomOverride = computed<boolean | null>(() => {
    const id = currentRoomId.value
    if (!id) return null
    return settingStore.strictUnverifiedRooms.includes(id) ? true : null
  })
  const globalStrict = computed(() => settingStore.blockUnverifiedDevicesEnabled)
  const strictActive = computed(() => roomOverride.value === true || globalStrict.value)

  async function refresh(): Promise<void> {
    const id = currentRoomId.value
    if (!id) {
      unverifiedCount.value = null
      status.value = 'idle'
      return
    }
    status.value = 'loading'
    try {
      const devices = await getUnverifiedDevicesInRoom(id)
      unverifiedCount.value = devices.length
      status.value = 'ready'
    } catch (err) {
      // 「无法判定」绝不能被当成「都已验证」——保持 null 并置 failed。
      logger.warn(`未验证设备查询失败（房间 ${id}），不会退化为 0: ${(err as Error)?.message ?? err}`)
      unverifiedCount.value = null
      status.value = 'failed'
    }
  }

  /** 把持久化的偏好施加到 SDK（幂等；crypto 未就绪时静默跳过，等初始化后重放） */
  function applyPolicy(): void {
    applyGlobalStrict(globalStrict.value)
    const id = currentRoomId.value
    if (id) applyRoomStrict(id, roomOverride.value)
  }

  function setRoomStrict(strict: boolean): void {
    const id = currentRoomId.value
    if (!id) return
    settingStore.setRoomStrictUnverified(id, strict)
    applyRoomStrict(id, strict ? true : null)
  }

  function setGlobalStrict(enabled: boolean): void {
    settingStore.setBlockUnverifiedDevicesEnabled(enabled)
    applyGlobalStrict(enabled)
  }

  watch(
    currentRoomId,
    async (id) => {
      if (!id) {
        unverifiedCount.value = null
        status.value = 'idle'
        return
      }
      applyPolicy()
      await refresh()
    },
    { immediate: true }
  )

  return {
    unverifiedCount,
    status,
    strictActive,
    roomOverride,
    globalStrict,
    refresh,
    setRoomStrict,
    setGlobalStrict
  }
}
