/**
 * OpenClaw 服务导出
 *
 * 仿飞书插件架构的 OpenClaw 客户端
 *
 * 功能:
 * - OpenAI 兼容 API
 * - Viking Router 智能路由优化（节省 67%-93% tokens）
 * - Function Calling 工具调用支持
 * - TrendRadar 新闻趋势工具集成
 */

export {
  openClawClient,
  useOpenClaw,
  ConnectionState
} from './OpenClawService'

export type {
  OpenClawConfig,
  OpenClawExtendedConfig,
  OpenClawMessage,
  StreamChunk,
  ChatCompletionRequest,
  ConnectionStateInfo
} from './OpenClawService'

export {
  vikingRouter,
  useVikingRouter
} from './VikingRouter'

export type {
  VikingRouterConfig,
  TaskComplexity,
  TaskAnalysis
} from './VikingRouter'

export {
  functionCallingManager,
  useFunctionCalling
} from './FunctionCallingManager'

export type {
  ToolDefinition,
  ToolCall,
  ToolResult
} from './FunctionCallingManager'
