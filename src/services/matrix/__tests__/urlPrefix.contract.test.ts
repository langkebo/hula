import { createClient } from 'matrix-js-sdk'
import { HttpResponse, http } from 'msw'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { setupMswServer } from '~/tests/msw'
import { matrixHttpClient } from '../MatrixHttpClient'
import { resetMatrixClientAccessorForTests, setMatrixClientAccessor } from '../matrixClientAccessor'

const HOMESERVER = 'https://hs.contract.test'

const seenUrls: string[] = []

setupMswServer(
  http.get(`${HOMESERVER}/_matrix/client/v3/sync`, ({ request }) => {
    seenUrls.push(request.url)
    return HttpResponse.json({ next_batch: 'batch-1' })
  })
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

  it('a hardcoded fully-prefixed path reaches the wire with exactly one /_matrix prefix', async () => {
    const result = await matrixHttpClient.request<{ next_batch: string }>('GET', '/_matrix/client/v3/sync')

    expect(result).toEqual({ next_batch: 'batch-1' })
    expect(seenUrls).toHaveLength(1)
    expect(seenUrls[0]).toBe(`${HOMESERVER}/_matrix/client/v3/sync`)
  })

  it('an unprefixed path converges to the same wire URL', async () => {
    await matrixHttpClient.request('GET', '/sync')

    expect(seenUrls).toEqual([`${HOMESERVER}/_matrix/client/v3/sync`])
  })

  it('a double-prefixed path converges to the same wire URL', async () => {
    await matrixHttpClient.request('GET', '/_matrix/client/v3/_matrix/client/v3/sync')

    expect(seenUrls).toEqual([`${HOMESERVER}/_matrix/client/v3/sync`])
  })
})
