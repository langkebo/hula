/**
 * Space service contract tests — MSW intercepts at the HTTP boundary.
 *
 * Uses a REAL SDK client so URL construction and prefix handling execute
 * through real matrix-js-sdk code. `getSpaceHierarchy` now delegates to
 * `SpaceManager.getSpaceHierarchyPage`（经 `initializeManagerExtensions`
 * 注册），命中 `/_matrix/client/v3/spaces/{id}/hierarchy`。
 */
import { createClient, initializeManagerExtensions, type MatrixClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixClientService } from '../../MatrixClientService'
import { matrixSpaceService } from '../MatrixSpaceService'

const HOMESERVER = 'https://hs.space-contract.test'
const seenUrls: { method: string; url: string }[] = []
let realClient: MatrixClient

vi.mock('@tauri-apps/plugin-log', () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}))

vi.mock('@/services/i18n', () => ({
  useI18nGlobal: () => ({ t: (key: string) => key })
}))

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/v3/spaces/:spaceId/hierarchy`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ rooms: [{ room_id: '!r1:hs', name: 'Room 1' }], next_batch: 'nb' })
  }),
  // 后端 `/spaces/{id}/rooms` 只回 id 字符串数组（不是 space 对象）—— 这是 S2 修的形态
  http.get(`${HOMESERVER}/_matrix/vendor/v1/spaces/:spaceId/rooms`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ rooms: ['!a:hs', '!b:hs'], next_batch: null })
  }),
  http.get(`${HOMESERVER}/_matrix/vendor/v1/spaces/:spaceId/children`, ({ request }) => {
    seenUrls.push({ method: request.method, url: request.url })
    return HttpResponse.json({ rooms: [{ room_id: '!a:hs' }, { room_id: '!b:hs' }], events: [] })
  })
)

describe('Space service URL construction contract (real SDK + msw)', () => {
  beforeEach(async () => {
    seenUrls.length = 0
    vi.spyOn(matrixClientService, 'getHomeserverUrl').mockReturnValue(HOMESERVER)
    vi.spyOn(matrixClientService, 'getClient').mockImplementation(() => realClient)
    vi.spyOn(matrixClientService, 'waitForClientReady').mockImplementation(() => Promise.resolve(realClient))
    realClient = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-at',
      userId: '@test:hs.space-contract.test',
      deviceId: 'DEV1'
    })
    await initializeManagerExtensions()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('getSpaceHierarchy hits /_matrix/client/v3/spaces/:spaceId/hierarchy via SpaceManager', async () => {
    const result = await matrixSpaceService.getSpaceHierarchy('!space:hs', { maxDepth: 3 })

    const calls = seenUrls.filter((u) => u.url.includes('/spaces/!space%3Ahs/hierarchy'))
    expect(calls).toHaveLength(1)
    expect(calls[0].method).toBe('GET')
    expect(calls[0].url).toBe(`${HOMESERVER}/_matrix/client/v3/spaces/!space%3Ahs/hierarchy?max_depth=3`)
    expect(result.rooms).toHaveLength(1)
    expect(result.next_batch).toBe('nb')
  })

  /**
   * 锁住 SDK 侧 `extractSpaces` 对 **id-only** 响应的归一化。
   *
   * 历史缺陷（S2）：`/spaces/{id}/rooms` 回 `{rooms:["!id"]}`，旧实现按 space 对象解析
   * ⇒ 每项变成 `{room_id:'', name:''}`，UI 渲染空白行。SDK 修好后必须钉住这个行为，
   * 否则哪天 SDK 升级把归一化改回对象形态，前端只会表现为「空间里房间全空」。
   */
  it('child.getSpaceRooms 把 id-only 的 rooms 归一化成 room_id', async () => {
    const rooms = await realClient.getSpaceManager().child.getSpaceRooms('!space:hs')

    // 失败时把实际请求的 URL 打出来（否则只看到 false≠true，无从判断拼接差异）
    expect(seenUrls.map((u) => u.url)).toContain(`${HOMESERVER}/_matrix/vendor/v1/spaces/!space%3Ahs/rooms`)
    expect(rooms.map((item) => item.room_id)).toEqual(['!a:hs', '!b:hs'])
  })

  /**
   * 锁住服务层**不走** `child.getSpaceRooms()` 而走 `children`。
   *
   * 理由见 `MatrixSpaceService.getSpaceRooms` 的注释：`/rooms` 只给 id，
   * `children` 给 `room_id` + `is_suggested`，服务层需要后者；若有人改回 `/rooms`，
   * 这里会因「未请求 /children」而红。
   */
  it('MatrixSpaceService.getSpaceRooms 走 /children 而不是 /rooms', async () => {
    const rows = await matrixSpaceService.getSpaceRooms('!space:hs')

    expect(seenUrls.map((u) => u.url)).toContain(`${HOMESERVER}/_matrix/vendor/v1/spaces/!space%3Ahs/children`)
    expect(seenUrls.some((u) => u.url.includes('/spaces/!space%3Ahs/rooms'))).toBe(false)
    expect(rows.map((row) => row.roomId)).toEqual(['!a:hs', '!b:hs'])
  })
})
