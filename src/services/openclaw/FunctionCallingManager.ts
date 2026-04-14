/**
 * Function Calling 管理器
 *
 * 支持 OpenAI 兼容的工具调用 API
 * 集成 TrendRadar 等工具
 */

import { ref, computed } from 'vue'
import { trendRadarClient } from '../trendradar'

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<
        string,
        {
          type: string
          description: string
          enum?: string[]
        }
      >
      required?: string[]
    }
  }
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
  status: 'pending' | 'running' | 'completed' | 'error'
  result?: unknown
  error?: string
}

export interface ToolResult {
  toolCallId: string
  content: string
  isError?: boolean
}

const TRENDRADAR_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_latest_news',
      description: '获取各大平台的最新热点新闻',
      parameters: {
        type: 'object',
        properties: {
          platforms: {
            type: 'array',
            description: '要获取新闻的平台列表',
            enum: ['知乎', '今日头条', '百度热搜', '微博', '抖音']
          },
          limit: {
            type: 'number',
            description: '每个平台获取的新闻数量'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_news',
      description: '搜索相关新闻',
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: '搜索关键词'
          },
          limit: {
            type: 'number',
            description: '返回结果数量'
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_trending_topics',
      description: '获取当前热门话题',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: '返回话题数量'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_topic_trend',
      description: '分析特定话题的趋势',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            description: '要分析的话题'
          }
        },
        required: ['topic']
      }
    }
  }
]

const BUILTIN_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前时间',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: '时区，如 Asia/Shanghai'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: '执行数学计算',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '数学表达式，如 2+2*3'
          }
        },
        required: ['expression']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'generate_random',
      description: '生成随机数',
      parameters: {
        type: 'object',
        properties: {
          min: {
            type: 'number',
            description: '最小值'
          },
          max: {
            type: 'number',
            description: '最大值'
          }
        },
        required: ['min', 'max']
      }
    }
  }
]

class FunctionCallingManager {
  private tools: Map<string, ToolDefinition> = new Map()
  private toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>> = new Map()
  private pendingCalls: Map<string, ToolCall> = new Map()

  constructor() {
    this.registerBuiltinTools()
    this.registerTrendRadarTools()
  }

  private registerBuiltinTools(): void {
    for (const tool of BUILTIN_TOOLS) {
      this.registerTool(tool, this.handleBuiltinTool.bind(this))
    }
  }

  private registerTrendRadarTools(): void {
    for (const tool of TRENDRADAR_TOOLS) {
      this.registerTool(tool, this.handleTrendRadarTool.bind(this))
    }
  }

  registerTool(tool: ToolDefinition, handler: (args: Record<string, unknown>) => Promise<unknown>): void {
    const name = tool.function.name
    this.tools.set(name, tool)
    this.toolHandlers.set(name, handler)
  }

  unregisterTool(name: string): void {
    this.tools.delete(name)
    this.toolHandlers.delete(name)
  }

  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values())
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys())
  }

  hasTool(name: string): boolean {
    return this.tools.has(name)
  }

  async executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const { id, function: fn } = toolCall
    const { name, arguments: argsStr } = fn

    this.pendingCalls.set(id, { ...toolCall, status: 'running' })

    try {
      const handler = this.toolHandlers.get(name)
      if (!handler) {
        throw new Error(`未知的工具: ${name}`)
      }

      const args = JSON.parse(argsStr) as Record<string, unknown>
      const result = await handler(args)

      this.pendingCalls.set(id, {
        ...toolCall,
        status: 'completed',
        result
      })

      return {
        toolCallId: id,
        content: JSON.stringify(result)
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : '未知错误'
      this.pendingCalls.set(id, {
        ...toolCall,
        status: 'error',
        error
      })

      return {
        toolCallId: id,
        content: error,
        isError: true
      }
    }
  }

  private async handleBuiltinTool(args: Record<string, unknown>): Promise<unknown> {
    const toolName = arguments.callee.caller?.name || ''

    if (toolName === 'get_current_time') {
      const timezone = (args.timezone as string) || 'Asia/Shanghai'
      return {
        time: new Date().toISOString(),
        timezone,
        localTime: new Date().toLocaleString('zh-CN', { timeZone: timezone })
      }
    }

    if (toolName === 'calculate') {
      const expression = args.expression as string
      try {
        const sanitized = expression.replace(/[^0-9+\-*/().]/g, '')
        const result = Function(`"use strict"; return (${sanitized})`)()
        return { expression, result }
      } catch {
        throw new Error('计算表达式无效')
      }
    }

    if (toolName === 'generate_random') {
      const min = args.min as number
      const max = args.max as number
      return {
        min,
        max,
        value: Math.floor(Math.random() * (max - min + 1)) + min
      }
    }

    throw new Error(`未知的内置工具: ${toolName}`)
  }

  private async handleTrendRadarTool(args: Record<string, unknown>): Promise<unknown> {
    const toolName = arguments.callee.caller?.name || ''

    if (toolName === 'get_latest_news') {
      const platforms = args.platforms as string[] | undefined
      const limit = (args.limit as number) || 10
      return await trendRadarClient.getLatestNews(platforms, limit)
    }

    if (toolName === 'search_news') {
      const keyword = args.keyword as string
      const limit = (args.limit as number) || 10
      return await trendRadarClient.searchNews(keyword, limit)
    }

    if (toolName === 'get_trending_topics') {
      const limit = (args.limit as number) || 10
      return await trendRadarClient.getTrendingTopics(limit)
    }

    if (toolName === 'analyze_topic_trend') {
      const topic = args.topic as string
      return await trendRadarClient.analyzeTopicTrend(topic)
    }

    throw new Error(`未知的 TrendRadar 工具: ${toolName}`)
  }

  getPendingCall(id: string): ToolCall | undefined {
    return this.pendingCalls.get(id)
  }

  getAllPendingCalls(): ToolCall[] {
    return Array.from(this.pendingCalls.values())
  }

  clearPendingCalls(): void {
    this.pendingCalls.clear()
  }
}

const functionCallingManager = new FunctionCallingManager()

const enabledTools = ref<string[]>(functionCallingManager.getToolNames())
const pendingToolCalls = ref<ToolCall[]>([])

export function useFunctionCalling() {
  const availableTools = computed(() => functionCallingManager.getToolDefinitions())

  const enabledToolDefinitions = computed(() => {
    return availableTools.value.filter((tool) => enabledTools.value.includes(tool.function.name))
  })

  function enableTool(name: string): void {
    if (functionCallingManager.hasTool(name) && !enabledTools.value.includes(name)) {
      enabledTools.value.push(name)
    }
  }

  function disableTool(name: string): void {
    const index = enabledTools.value.indexOf(name)
    if (index > -1) {
      enabledTools.value.splice(index, 1)
    }
  }

  function toggleTool(name: string): void {
    if (enabledTools.value.includes(name)) {
      disableTool(name)
    } else {
      enableTool(name)
    }
  }

  function isToolEnabled(name: string): boolean {
    return enabledTools.value.includes(name)
  }

  async function executeToolCall(toolCall: ToolCall): Promise<ToolResult> {
    const result = await functionCallingManager.executeToolCall(toolCall)
    pendingToolCalls.value = functionCallingManager.getAllPendingCalls()
    return result
  }

  async function executeAllPendingCalls(calls: ToolCall[]): Promise<ToolResult[]> {
    const results: ToolResult[] = []
    for (const call of calls) {
      const result = await executeToolCall(call)
      results.push(result)
    }
    return results
  }

  function clearPendingCalls(): void {
    functionCallingManager.clearPendingCalls()
    pendingToolCalls.value = []
  }

  function registerCustomTool(
    tool: ToolDefinition,
    handler: (args: Record<string, unknown>) => Promise<unknown>
  ): void {
    functionCallingManager.registerTool(tool, handler)
    if (!enabledTools.value.includes(tool.function.name)) {
      enabledTools.value.push(tool.function.name)
    }
  }

  function unregisterCustomTool(name: string): void {
    functionCallingManager.unregisterTool(name)
    disableTool(name)
  }

  return {
    availableTools,
    enabledTools,
    enabledToolDefinitions,
    pendingToolCalls,
    enableTool,
    disableTool,
    toggleTool,
    isToolEnabled,
    executeToolCall,
    executeAllPendingCalls,
    clearPendingCalls,
    registerCustomTool,
    unregisterCustomTool
  }
}

export { functionCallingManager }
export default useFunctionCalling
