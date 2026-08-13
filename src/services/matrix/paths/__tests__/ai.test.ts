import { describe, expect, it } from 'vitest'
import { AI } from '../ai'

describe('AI', () => {
  it('constants built on PREFIX_V1', () => {
    expect(AI.CONNECTIONS).toBe('/_matrix/client/v1/ai/connections')
    expect(AI.MCP_TOOLS).toBe('/_matrix/client/v1/ai/mcp/tools')
    expect(AI.MCP_TOOLS_CALL).toBe('/_matrix/client/v1/ai/mcp/tools/call')
  })

  it('CONNECTION_BY_ID encodes id', () => {
    expect(AI.CONNECTION_BY_ID('c1')).toBe('/_matrix/client/v1/ai/connections/c1')
  })
})
