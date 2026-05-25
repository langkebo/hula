export const AI = {
  CONNECTIONS: '/_matrix/client/v1/ai/connections',
  CONNECTION_BY_ID: (id: string) => `/_matrix/client/v1/ai/connections/${encodeURIComponent(id)}`,
  MCP_TOOLS: '/_matrix/client/v1/ai/mcp/tools',
  MCP_TOOLS_CALL: '/_matrix/client/v1/ai/mcp/tools/call'
} as const
