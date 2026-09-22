import { beforeEach, describe, expect, it } from 'vitest'
import { type NotificationAccountDataClient, pullConfigFromAccountData } from '../configAccountDataSync'
import { NOTIFICATION_CONFIG_STORAGE_KEY, NotificationConfigStore } from '../notificationConfig'

/** 账号数据桩：只需要 `getAccountData`；`setAccountData` 仅为满足接口形状。 */
function accountDataClient(content: Record<string, unknown> | undefined): NotificationAccountDataClient {
  return {
    setAccountData: async () => undefined,
    getAccountData: () => (content === undefined ? undefined : { getContent: () => content })
  }
}

function persistedConfig(): Record<string, unknown> {
  return JSON.parse(localStorage.getItem(NOTIFICATION_CONFIG_STORAGE_KEY) as string) as Record<string, unknown>
}

/**
 * 拉取语义回归：拆分前 `syncConfigFromAccountData` 是「清洗后整体替换 events」，
 * 拆分后误用了 `setConfig` 的浅合并，且不再清洗服务端 events。
 * 这两个用例分别钉住替换语义与清洗语义。
 */
describe('pullConfigFromAccountData', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('replaces the local events map instead of retaining local-only keys', async () => {
    localStorage.setItem(NOTIFICATION_CONFIG_STORAGE_KEY, JSON.stringify({ events: { local_only: true } }))
    const store = new NotificationConfigStore()

    const pulled = await pullConfigFromAccountData(accountDataClient({ events: { thread_mention: false } }), store)

    expect(pulled).toBe(true)
    expect(store.getConfig().events).toEqual({ thread_mention: false })
    expect(persistedConfig().events).toEqual({ thread_mention: false })
  })

  it('drops non-boolean event entries from account data instead of persisting them', async () => {
    const store = new NotificationConfigStore()

    await pullConfigFromAccountData(
      accountDataClient({ events: { thread_mention: 'false', other_kind: true } }),
      store
    )

    expect(store.getConfig().events).toEqual({ other_kind: true })
    expect(persistedConfig().events).toEqual({ other_kind: true })
  })
})
