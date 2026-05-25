import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openClawAssistantRoomService } from '../OpenClawAssistantRoomService'

describe('OpenClawAssistantRoomService (已移除 OpenClawX 后端)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ensureRegistered 可重复调用且不会抛错', () => {
    // 第一次调用
    expect(() => openClawAssistantRoomService.ensureRegistered()).not.toThrow()
    // 重复调用（幂等）
    expect(() => openClawAssistantRoomService.ensureRegistered()).not.toThrow()
  })
})
