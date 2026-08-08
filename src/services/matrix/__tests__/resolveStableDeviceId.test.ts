import { describe, expect, it } from 'vitest'
import type { MatrixClientConfig } from '@/services/matrix/MatrixClientService'
import { resolveStableDeviceId } from '@/services/matrix/MatrixClientService'

describe('resolveStableDeviceId — P0-#2 复用持久化 deviceId', () => {
  it('配置中已有持久化 deviceId 时应优先复用，而非采用 sdk 新生成的设备', () => {
    const config: MatrixClientConfig = {
      homeserverUrl: 'https://matrix.test',
      userId: '@test:matrix.test',
      accessToken: 'tok',
      deviceId: 'STABLE_DEVICE'
    }
    // sdk 在初始化时新生成的设备（每次登录都不同）
    const freshlyGenerated = 'FRESH_DEVICE'

    expect(resolveStableDeviceId(config, freshlyGenerated)).toBe('STABLE_DEVICE')
  })

  it('配置中无 deviceId 时才回退到 sdk 生成的设备', () => {
    const config: MatrixClientConfig = {
      homeserverUrl: 'https://matrix.test',
      userId: '@test:matrix.test',
      accessToken: 'tok'
    }
    expect(resolveStableDeviceId(config, 'FRESH_DEVICE')).toBe('FRESH_DEVICE')
  })

  it('两者皆无时返回 undefined', () => {
    const config: MatrixClientConfig = {
      homeserverUrl: 'https://matrix.test',
      userId: '@test:matrix.test',
      accessToken: 'tok'
    }
    expect(resolveStableDeviceId(config, undefined)).toBeUndefined()
  })
})
