/**
 * getMapStyleUrl 单元测试：well-known → 客户端配置 回退链
 */

import { describe, expect, it } from 'vitest'
import type { MatrixClient } from '../../sdk'
import { getMapStyleUrl } from '../mapStyle'

const WELL_KNOWN_URL = 'https://tiles.example.com/style.json'

function makeClient(wellKnown: unknown): MatrixClient {
  return { getClientWellKnown: () => wellKnown } as unknown as MatrixClient
}

describe('getMapStyleUrl', () => {
  it('returns the well-known m.tile_server.map_style_url when present', () => {
    const client = makeClient({ 'm.tile_server': { map_style_url: WELL_KNOWN_URL } })

    expect(getMapStyleUrl(client)).toBe(WELL_KNOWN_URL)
  })

  it('returns undefined when the client has no well-known', () => {
    expect(getMapStyleUrl(makeClient(undefined))).toBeUndefined()
  })

  it('returns undefined when m.tile_server is absent', () => {
    expect(getMapStyleUrl(makeClient({}))).toBeUndefined()
  })

  it('returns undefined when m.tile_server is present but map_style_url is missing', () => {
    expect(getMapStyleUrl(makeClient({ 'm.tile_server': {} }))).toBeUndefined()
  })

  it('treats an empty well-known map_style_url as absent and falls through to config', () => {
    expect(getMapStyleUrl(makeClient({ 'm.tile_server': { map_style_url: '' } }))).toBeUndefined()
  })
})
