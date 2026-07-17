import { PREFIX_V1 } from './prefixes'

export const AI = {
  CONNECTIONS: PREFIX_V1 + '/ai/connections',
  CONNECTION_BY_ID: (id: string) => `${PREFIX_V1}/ai/connections/${encodeURIComponent(id)}`,
  MCP_TOOLS: PREFIX_V1 + '/ai/mcp/tools',
  MCP_TOOLS_CALL: PREFIX_V1 + '/ai/mcp/tools/call'
} as const
