import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixRoomMetadataService } from '@/services/matrix/room/MetadataService'
import { roomOperations } from '@/services/matrix/room/RoomOperations'
import { matrixAccountService } from '@/services/matrix/user/MatrixAccountService'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('useRoomUpgradeFlow')

interface RoomVersionInfo {
  version: string
  status?: string
}

interface UseRoomUpgradeFlowOptions {
  roomId: string | null
  /** 是否可升级(由调用方传入权限判断) */
  canUpgrade?: boolean
}

/**
 * 跨端房间升级流程 composable
 * PC 端 RoomDetailPane.vue 与移动端 ChatSetting.vue 共用此逻辑
 *
 * 流程:
 * 1. load() 读取当前房间版本 + 服务端可用版本列表
 * 2. upgrade(newVersion) 调用 roomOperations.upgradeRoom,创建替换房间
 *
 * 服务端能力来源:
 * - 当前版本:`m.room.create` 事件中的 `room_version`
 * - 可用版本:`matrixAccountService.getCapabilities()` 返回的 `m.room_versions.available`
 */
export function useRoomUpgradeFlow(options: UseRoomUpgradeFlowOptions) {
  const { t } = useI18n()
  const { showFeedback } = useActionFeedback()

  const currentVersion = ref<string | null>(null)
  const availableVersions = ref<RoomVersionInfo[]>([])
  const defaultVersion = ref<string | null>(null)
  const targetVersion = ref<string | null>(null)
  const loading = ref(false)
  const upgrading = ref(false)
  const errorMessage = ref<string | null>(null)

  const canUpgrade = computed(() => options.canUpgrade !== false && !!options.roomId)
  const hasVersions = computed(() => availableVersions.value.length > 0)
  const newerVersions = computed(() => {
    if (!currentVersion.value) return availableVersions.value
    return availableVersions.value.filter((v) => Number(v.version) > Number(currentVersion.value))
  })

  const resolveTargetVersion = (): string | null => {
    if (targetVersion.value) return targetVersion.value
    if (defaultVersion.value) return defaultVersion.value
    if (newerVersions.value.length > 0) {
      // 选最新版本
      return newerVersions.value[newerVersions.value.length - 1]?.version ?? null
    }
    return null
  }

  /**
   * 解析服务端 capabilities 中的 m.room_versions 字段
   * 形如: { default: '11', available: { '9': 'stable', '10': 'stable', '11': 'stable' } }
   */
  const parseRoomVersions = (caps: Record<string, unknown>): void => {
    const roomVersions = (caps['m.room_versions'] ?? caps['room_versions']) as
      | { default?: string; available?: Record<string, string> }
      | undefined

    if (!roomVersions) return

    defaultVersion.value = roomVersions.default ?? null
    const available = roomVersions.available ?? {}
    availableVersions.value = Object.entries(available).map(([version, status]) => ({
      version,
      status: typeof status === 'string' ? status : undefined
    }))
    availableVersions.value.sort((a, b) => Number(a.version) - Number(b.version))
  }

  const load = async (): Promise<void> => {
    const roomId = options.roomId
    if (!roomId) {
      currentVersion.value = null
      availableVersions.value = []
      return
    }

    loading.value = true
    errorMessage.value = null

    try {
      const [version, caps] = await Promise.all([
        matrixRoomMetadataService.getRoomVersion(roomId),
        matrixAccountService.getCapabilities()
      ])
      currentVersion.value = version
      parseRoomVersions(caps ?? {})
    } catch (err) {
      logger.error('加载房间版本信息失败', err)
      errorMessage.value = t('room_advanced.room_upgrade.failed')
    } finally {
      loading.value = false
    }
  }

  /**
   * 执行房间升级
   * @returns 替换房间的 roomId,失败时返回 null
   */
  const upgrade = async (newVersion?: string): Promise<string | null> => {
    const roomId = options.roomId
    if (!roomId) {
      showFeedback(t('room_advanced.room_upgrade.failed'), 'error')
      return null
    }

    const target = newVersion ?? resolveTargetVersion()
    if (!target) {
      showFeedback(t('room_advanced.room_upgrade.failed'), 'error')
      return null
    }

    upgrading.value = true
    errorMessage.value = null

    try {
      const replacementRoomId = await roomOperations.upgradeRoom(roomId, target)
      showFeedback(t('room_advanced.room_upgrade.success'), 'success')
      return replacementRoomId
    } catch (err) {
      logger.error('房间升级失败', err)
      errorMessage.value = t('room_advanced.room_upgrade.failed')
      showFeedback(errorMessage.value, 'error')
      return null
    } finally {
      upgrading.value = false
    }
  }

  return {
    currentVersion,
    availableVersions,
    defaultVersion,
    targetVersion,
    loading,
    upgrading,
    errorMessage,
    canUpgrade,
    hasVersions,
    newerVersions,
    load,
    upgrade,
    resolveTargetVersion
  }
}
