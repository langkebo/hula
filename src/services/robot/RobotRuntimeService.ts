import { createLogger } from '@/utils/Logger'
import type { RobotDefinition, RobotInstance, RobotRuntimeStatus } from './types'

const logger = createLogger('RobotRuntimeService')

type RuntimeListener = (instance: RobotInstance) => void

function createRuntimeId(roomId: string, botId: string): string {
  return `${roomId}:${botId}`
}

class RobotRuntimeService {
  private definitions = new Map<string, RobotDefinition>()
  private runtimes = new Map<string, RobotInstance>()
  private listeners = new Set<RuntimeListener>()

  registerDefinition(definition: RobotDefinition): void {
    this.definitions.set(definition.id, definition)
  }

  getDefinition(botId: string): RobotDefinition | null {
    return this.definitions.get(botId) ?? null
  }

  listDefinitions(): RobotDefinition[] {
    return [...this.definitions.values()]
  }

  ensureRuntime(roomId: string, botId: string, ownerUserId?: string): RobotInstance {
    const runtimeId = createRuntimeId(roomId, botId)
    const existing = this.runtimes.get(runtimeId)
    if (existing) {
      return existing
    }

    const now = Date.now()
    const runtime: RobotInstance = {
      id: runtimeId,
      roomId,
      botId,
      ownerUserId,
      status: 'idle',
      createdAt: now,
      updatedAt: now
    }
    this.runtimes.set(runtimeId, runtime)
    this.emit(runtime)
    return runtime
  }

  hydrateRuntime(instance: RobotInstance): RobotInstance {
    const runtimeId = createRuntimeId(instance.roomId, instance.botId)
    const nextRuntime: RobotInstance = {
      ...instance,
      id: runtimeId,
      metadata: instance.metadata ? { ...instance.metadata } : undefined
    }
    this.runtimes.set(runtimeId, nextRuntime)
    this.emit(nextRuntime)
    return nextRuntime
  }

  updateStatus(
    roomId: string,
    botId: string,
    status: RobotRuntimeStatus,
    metadata?: Record<string, unknown>
  ): RobotInstance {
    const runtime = this.ensureRuntime(roomId, botId)
    runtime.status = status
    runtime.updatedAt = Date.now()
    runtime.metadata = {
      ...runtime.metadata,
      ...metadata
    }
    this.emit(runtime)
    logger.info(`[RobotRuntime] ${runtime.id} -> ${status}`)
    return runtime
  }

  getRuntime(roomId: string, botId: string): RobotInstance | null {
    return this.runtimes.get(createRuntimeId(roomId, botId)) ?? null
  }

  listRuntimes(roomId?: string): RobotInstance[] {
    const all = [...this.runtimes.values()]
    return roomId ? all.filter((runtime) => runtime.roomId === roomId) : all
  }

  removeRuntime(roomId: string, botId: string): boolean {
    return this.runtimes.delete(createRuntimeId(roomId, botId))
  }

  subscribe(listener: RuntimeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(instance: RobotInstance): void {
    for (const listener of this.listeners) {
      listener({ ...instance, metadata: instance.metadata ? { ...instance.metadata } : undefined })
    }
  }
}

export const robotRuntimeService = new RobotRuntimeService()
