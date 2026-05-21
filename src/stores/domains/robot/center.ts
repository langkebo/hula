import { defineStore, storeToRefs } from 'pinia'
import { StoresEnum } from '@/enums'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { matrixRoomService } from '@/services/matrix/room/MatrixRoomService'
import { robotAuditService } from '@/services/robot/RobotAuditService'
import { robotDispatchService } from '@/services/robot/RobotDispatchService'
import { robotPluginRegistry } from '@/services/robot/RobotPluginRegistry'
import { robotPresenceService } from '@/services/robot/RobotPresenceService'
import { ROBOT_ROOM_STATE_EVENT_TYPE, robotRoomStateSyncService } from '@/services/robot/RobotRoomStateSyncService'
import { robotRuntimeService } from '@/services/robot/RobotRuntimeService'
import type { RobotDefinition, RobotDispatchResult, RobotInstance, RobotRuntimeStatus } from '@/services/robot/types'
import { createLogger } from '@/utils/Logger'
import { useUserStore } from '../user/user'

const logger = createLogger('RobotCenterStore')

const BUILTIN_ROBOT_DEFINITIONS: RobotDefinition[] = [
  {
    id: 'openclaw-assistant',
    name: 'OpenClaw Assistant',
    description: '房间内 AI 对话与总结助手',
    provider: 'openclaw',
    supportsRoomDeployment: true,
    supportedMessageKinds: ['text', 'rich_text', 'link_card', 'tool_result'],
    requiredPermissions: ['room.robot.deploy', 'room.robot.invoke'],
    version: '0.1.0'
  },
  {
    id: 'trendradar-briefing',
    name: 'TrendRadar Briefing',
    description: '用于热点摘要、资讯播报与链接卡片推送',
    provider: 'trendradar',
    supportsRoomDeployment: true,
    supportedMessageKinds: ['text', 'link_card', 'system_notice'],
    requiredPermissions: ['room.robot.deploy'],
    version: '0.1.0'
  },
  {
    id: 'hula-notifier',
    name: 'HuLa Notifier',
    description: '用于系统通知、提醒和自动播报',
    provider: 'hula',
    supportsRoomDeployment: true,
    supportedMessageKinds: ['text', 'system_notice', 'task_card'],
    requiredPermissions: ['room.robot.deploy', 'room.robot.broadcast'],
    version: '0.1.0'
  }
]

function cloneDefinition(definition: RobotDefinition): RobotDefinition {
  return {
    ...definition,
    supportedMessageKinds: [...definition.supportedMessageKinds],
    requiredPermissions: definition.requiredPermissions ? [...definition.requiredPermissions] : undefined
  }
}

function createInstanceKey(roomId: string, botId: string): string {
  return `${roomId}:${botId}`
}

function createTraceId(botId: string): string {
  return `${botId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function cloneInstance(instance: RobotInstance): RobotInstance {
  return {
    ...instance,
    id: createInstanceKey(instance.roomId, instance.botId),
    metadata: instance.metadata ? { ...instance.metadata } : undefined
  }
}

function normalizeRoomId(roomId: string | undefined): string | null {
  return typeof roomId === 'string' && roomId ? roomId : null
}

export const useRobotCenterStore = defineStore(
  StoresEnum.BOT,
  () => {
    const definitions = ref<RobotDefinition[]>([])
    const instances = ref<RobotInstance[]>([])
    const initialized = ref(false)
    const stateBridgeInitialized = ref(false)
    const hydratedRoomIds = ref<string[]>([])
    const observedRoomIds = new Set<string>()

    const definitionsMap = computed(() => {
      return definitions.value.reduce<Record<string, RobotDefinition>>((accumulator, definition) => {
        accumulator[definition.id] = definition
        return accumulator
      }, {})
    })

    const activeInstances = computed(() => instances.value.filter((instance) => instance.status !== 'offline'))

    const markRoomHydrated = (roomId: string) => {
      if (!hydratedRoomIds.value.includes(roomId)) {
        hydratedRoomIds.value = [...hydratedRoomIds.value, roomId]
      }
    }

    const replaceRoomInstances = (roomId: string, nextInstances: RobotInstance[]) => {
      const nextBotIds = new Set(nextInstances.map((instance) => instance.botId))
      instances.value
        .filter((instance) => instance.roomId === roomId && !nextBotIds.has(instance.botId))
        .forEach((instance) => {
          robotRuntimeService.removeRuntime(roomId, instance.botId)
          robotPresenceService.setPresence(roomId, instance.botId, 'offline', '机器人状态已同步')
        })

      instances.value = instances.value.filter((instance) => instance.roomId !== roomId)
      nextInstances.forEach((instance) => {
        const nextInstance = cloneInstance(instance)
        robotRuntimeService.hydrateRuntime(nextInstance)
        robotPresenceService.setPresence(roomId, nextInstance.botId, nextInstance.status)
        instances.value.push(nextInstance)
      })
      markRoomHydrated(roomId)
    }

    const applyRoomStateContent = (roomId: string, content: unknown) => {
      replaceRoomInstances(roomId, robotRoomStateSyncService.deserializeRoomState(roomId, content))
    }

    const attachRoomStateObserver = (room: unknown) => {
      const roomLike = room as {
        roomId?: string
        currentState?: {
          getStateEvents?: (eventType: string, stateKey: string) => { getContent?: () => unknown } | null
        }
        on?: (event: string, callback: (event: unknown) => void) => void
      }
      const roomId = normalizeRoomId(roomLike.roomId)
      if (!roomId || observedRoomIds.has(roomId)) {
        return
      }

      observedRoomIds.add(roomId)

      const stateEvent = roomLike.currentState?.getStateEvents?.(ROBOT_ROOM_STATE_EVENT_TYPE, '')
      if (stateEvent?.getContent) {
        applyRoomStateContent(roomId, stateEvent.getContent())
      }

      if (typeof roomLike.on === 'function') {
        roomLike.on('RoomState.events', (event: unknown) => {
          const matrixEvent = event as {
            getType?: () => string
            getStateKey?: () => string | null
            getContent?: () => unknown
          }
          if (matrixEvent.getType?.() !== ROBOT_ROOM_STATE_EVENT_TYPE) {
            return
          }
          if ((matrixEvent.getStateKey?.() ?? '') !== '') {
            return
          }
          applyRoomStateContent(roomId, matrixEvent.getContent?.())
        })
      }
    }

    const ensureStateBridge = async () => {
      if (stateBridgeInitialized.value) {
        return
      }

      const client = matrixClientService.getClient()
      if (!client) {
        return
      }

      const existingRooms = await matrixRoomService.getRooms()
      existingRooms.forEach(attachRoomStateObserver)
      matrixClientService.on('room', attachRoomStateObserver)
      stateBridgeInitialized.value = true
    }

    const persistRoomInstances = async (roomId: string) => {
      try {
        await robotRoomStateSyncService.saveRoomInstances(
          roomId,
          activeInstances.value.filter((item) => item.roomId === roomId)
        )
      } catch (err) {
        logger.warn(`[RobotCenter] failed to persist robot room state for ${roomId}: ${String(err)}`)
      }
    }

    const hydrateRoomInstances = async (roomId: string, force = false): Promise<RobotInstance[]> => {
      ensureBuiltins()
      ensureStateBridge()

      if (!force && hydratedRoomIds.value.includes(roomId)) {
        return activeInstances.value.filter((instance) => instance.roomId === roomId)
      }

      const nextInstances = await robotRoomStateSyncService.loadRoomInstances(roomId)
      replaceRoomInstances(roomId, nextInstances)
      return activeInstances.value.filter((instance) => instance.roomId === roomId)
    }

    const ensureBuiltins = () => {
      if (initialized.value) {
        ensureStateBridge()
        return
      }

      definitions.value = BUILTIN_ROBOT_DEFINITIONS.map(cloneDefinition)
      definitions.value.forEach((definition) => {
        robotRuntimeService.registerDefinition(definition)
        robotPluginRegistry.register({ definition })
      })
      initialized.value = true
      ensureStateBridge()
    }

    const listDefinitions = () => {
      ensureBuiltins()
      return definitions.value
    }

    const listRoomInstances = (roomId: string): RobotInstance[] => {
      ensureBuiltins()
      void hydrateRoomInstances(roomId)
      return activeInstances.value.filter((instance) => instance.roomId === roomId)
    }

    const getRoomInstance = (roomId: string, botId: string): RobotInstance | null => {
      ensureBuiltins()
      void hydrateRoomInstances(roomId)
      return activeInstances.value.find((instance) => instance.roomId === roomId && instance.botId === botId) ?? null
    }

    const syncInstance = (instance: RobotInstance) => {
      const nextInstance = cloneInstance(instance)
      const index = instances.value.findIndex((item) => item.id === nextInstance.id)
      if (index >= 0) {
        instances.value[index] = nextInstance
      } else {
        instances.value.push(nextInstance)
      }
      robotRuntimeService.hydrateRuntime(nextInstance)
      return nextInstance
    }

    const deployRobot = (roomId: string, botId: string): RobotInstance | null => {
      ensureBuiltins()
      const definition = definitionsMap.value[botId]
      if (!definition || !definition.supportsRoomDeployment) {
        return null
      }

      const existing = getRoomInstance(roomId, botId)
      if (existing) {
        return existing
      }

      const userStore = useUserStore()
      const { userInfo } = storeToRefs(userStore)
      const ownerUserId = userInfo.value?.uid
      const runtime = robotRuntimeService.ensureRuntime(roomId, botId, ownerUserId)
      robotPresenceService.setPresence(roomId, botId, runtime.status, '机器人已部署')
      robotAuditService.append({
        type: 'robot.deploy',
        actorUserId: ownerUserId,
        roomId,
        botId,
        payload: {
          provider: definition.provider
        }
      })
      const nextInstance = syncInstance(runtime)
      void persistRoomInstances(roomId)
      return nextInstance
    }

    const setRobotStatus = (
      roomId: string,
      botId: string,
      status: RobotRuntimeStatus,
      message?: string,
      metadata?: Record<string, unknown>
    ): RobotInstance | null => {
      ensureBuiltins()
      const existing = getRoomInstance(roomId, botId)
      if (!existing) {
        return null
      }
      const runtime = robotRuntimeService.updateStatus(roomId, botId, status, metadata)
      robotPresenceService.setPresence(roomId, botId, status, message)
      const nextInstance = syncInstance(runtime)
      void persistRoomInstances(roomId)
      return nextInstance
    }

    const pauseRobot = (roomId: string, botId: string): RobotInstance | null => {
      return setRobotStatus(roomId, botId, 'paused', '机器人已暂停')
    }

    const resumeRobot = (roomId: string, botId: string): RobotInstance | null => {
      return setRobotStatus(roomId, botId, 'idle', '机器人已恢复')
    }

    const undeployRobot = (roomId: string, botId: string): boolean => {
      ensureBuiltins()
      const existing = getRoomInstance(roomId, botId)
      if (!existing) {
        return false
      }

      const userStore = useUserStore()
      const { userInfo } = storeToRefs(userStore)
      const runtime = robotRuntimeService.updateStatus(roomId, botId, 'offline')
      robotPresenceService.setPresence(roomId, botId, 'offline', '机器人已移除')
      syncInstance(runtime)
      robotRuntimeService.removeRuntime(roomId, botId)
      const key = createInstanceKey(roomId, botId)
      instances.value = instances.value.filter((instance) => createInstanceKey(instance.roomId, instance.botId) !== key)
      robotAuditService.append({
        type: 'robot.undeploy',
        actorUserId: userInfo.value?.uid,
        roomId,
        botId
      })
      void persistRoomInstances(roomId)
      return true
    }

    const invokeRobot = async (
      roomId: string,
      botId: string,
      body: string,
      metadata?: Record<string, unknown>
    ): Promise<RobotDispatchResult> => {
      ensureBuiltins()
      await hydrateRoomInstances(roomId)

      const instance = getRoomInstance(roomId, botId)
      if (!instance) {
        return {
          traceId: createTraceId(botId),
          roomId,
          botId,
          delivered: false,
          error: '机器人尚未部署'
        }
      }

      if (instance.status === 'paused') {
        return {
          traceId: createTraceId(botId),
          roomId,
          botId,
          delivered: false,
          error: '机器人当前已暂停'
        }
      }

      const userStore = useUserStore()
      const { userInfo } = storeToRefs(userStore)
      const traceId = createTraceId(botId)

      setRobotStatus(roomId, botId, 'thinking', '正在生成回复', {
        lastTraceId: traceId
      })

      robotAuditService.append({
        type: 'robot.invoke',
        actorUserId: userInfo.value?.uid,
        roomId,
        botId,
        traceId,
        payload: {
          body
        }
      })

      const result = await robotDispatchService.dispatch({
        traceId,
        roomId,
        botId,
        kind: 'text',
        body,
        metadata: {
          ...metadata,
          userId: userInfo.value?.uid
        }
      })

      if (result.delivered) {
        setRobotStatus(roomId, botId, 'idle', '已发送回复', {
          lastTraceId: traceId,
          lastEventId: result.eventId,
          lastPrompt: body,
          lastDeliveredAt: Date.now()
        })
      } else {
        setRobotStatus(roomId, botId, 'error', result.error || '机器人发送失败', {
          lastTraceId: traceId,
          lastPrompt: body,
          lastError: result.error || '机器人发送失败'
        })
      }

      return result
    }

    return {
      definitions,
      instances,
      initialized,
      hydratedRoomIds,
      definitionsMap,
      activeInstances,
      ensureBuiltins,
      hydrateRoomInstances,
      listDefinitions,
      listRoomInstances,
      getRoomInstance,
      deployRobot,
      setRobotStatus,
      pauseRobot,
      resumeRobot,
      undeployRobot,
      invokeRobot
    }
  },
  {
    persist: true
  }
)
