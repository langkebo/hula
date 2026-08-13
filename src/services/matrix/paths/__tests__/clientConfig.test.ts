import { describe, expect, it } from 'vitest'
import { CLIENT_CONFIG } from '../clientConfig'

describe('CLIENT_CONFIG', () => {
  it('CLIENT endpoint', () => {
    expect(CLIENT_CONFIG.CLIENT).toBe('/_matrix/client/v1/config/client')
  })
})
