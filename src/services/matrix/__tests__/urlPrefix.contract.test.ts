import { createClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixHttpClient } from '../MatrixHttpClient'
import { resetMatrixClientAccessorForTests, setMatrixClientAccessor } from '../matrixClientAccessor'

const HOMESERVER = 'https://hs.contract.test'

/**
 * B-1 前缀解析等价性用例表。
 *
 * 前缀剥离的单一权威来源是 SDK `BaseManager.KNOWN_PREFIXES`（21 条，长前缀优先，单遍剥离）。
 * 本表逐项锁定「传入完整前缀路径」在网线上产生的最终 URL，确保不会出现
 * 「完整前缀 + SDK 默认前缀」二次拼接导致的 URL 翻倍（双前缀 → 404）。
 *
 * 相比旧实现维护的 12 条本地前缀表，SDK 表额外覆盖 federation / key / identity /
 * msc3575 / msc4186 等命名空间——表中标注「旧本地表未覆盖」的两项即为新增保障。
 */
const CASES: Array<{ label: string; input: string; expectedPath: string }> = [
  {
    label: '默认 v3 前缀 + room send 子路径',
    input: '/_matrix/client/v3/rooms/!room:hs.contract.test/send/m.room.message/txn-1',
    expectedPath: '/_matrix/client/v3/rooms/!room:hs.contract.test/send/m.room.message/txn-1'
  },
  {
    label: 'synapse admin v1 命名空间',
    input: '/_synapse/admin/v1/users',
    expectedPath: '/_synapse/admin/v1/users'
  },
  {
    label: 'vendor v1 命名空间',
    input: '/_matrix/vendor/v1/friends',
    expectedPath: '/_matrix/vendor/v1/friends'
  },
  {
    label: 'media v3 命名空间',
    input: '/_matrix/media/v3/upload',
    expectedPath: '/_matrix/media/v3/upload'
  },
  {
    label: 'Sliding Sync simplified_msc3575（旧本地表未覆盖）',
    input: '/_matrix/client/unstable/org.matrix.simplified_msc3575/sync',
    expectedPath: '/_matrix/client/unstable/org.matrix.simplified_msc3575/sync'
  },
  {
    label: 'federation v1 命名空间（旧本地表未覆盖）',
    input: '/_matrix/federation/v1/version',
    expectedPath: '/_matrix/federation/v1/version'
  },
  {
    label: '短路径回落到默认 v3 前缀',
    input: '/sync',
    expectedPath: '/_matrix/client/v3/sync'
  }
]

const seenUrls: string[] = []

setupMswServer(
  ...CASES.map(({ expectedPath }) =>
    http.get(`${HOMESERVER}${expectedPath}`, ({ request }) => {
      seenUrls.push(request.url)
      return HttpResponse.json({ ok: true })
    })
  )
)

describe('URL prefix contract (real SDK http layer + msw)', () => {
  beforeEach(() => {
    seenUrls.length = 0
    const client = createClient({
      baseUrl: HOMESERVER,
      accessToken: 'contract-token',
      userId: '@contract:hs.contract.test'
    })
    setMatrixClientAccessor({ getClient: () => client })
  })

  afterEach(() => {
    resetMatrixClientAccessorForTests()
  })

  for (const { label, input, expectedPath } of CASES) {
    it(`${label}: 输入 ${input} 落到 ${expectedPath}`, async () => {
      await matrixHttpClient.request('GET', input)

      expect(seenUrls).toEqual([`${HOMESERVER}${expectedPath}`])
    })
  }
})
