import { robotCredentialService } from '@/services/robot/RobotCredentialService'
import { trendRadarClient } from '@/services/trendradar/TrendRadarService'
import { createLogger } from '@/utils/Logger'
import { robotDispatchService } from './RobotDispatchService'
import { robotMessageProtocolService } from './RobotMessageProtocolService'
import type { RobotDispatchMessage, RobotDispatchResult } from './types'

const logger = createLogger('TrendRadarBriefingRoomService')
const TRENDRADAR_BRIEFING_BOT_ID = 'trendradar-briefing'

class TrendRadarBriefingRoomService {
  private registered = false

  ensureRegistered(): void {
    if (this.registered) {
      return
    }
    robotDispatchService.register(TRENDRADAR_BRIEFING_BOT_ID, async (message) => this.handleDispatch(message))
    this.registered = true
  }

  private buildPrompt(message: RobotDispatchMessage): string {
    const prompt = typeof message.metadata?.prompt === 'string' ? message.metadata.prompt.trim() : ''
    return prompt || message.body.trim() || '请播报当前热点摘要。'
  }

  private async handleDispatch(message: RobotDispatchMessage): Promise<RobotDispatchResult> {
    try {
      const userId = typeof message.metadata?.userId === 'string' ? message.metadata.userId : undefined
      const config = await robotCredentialService.loadTrendRadarConfig(
        {
          apiUrl: 'http://127.0.0.1:3333/mcp',
          apiKey: ''
        },
        { userId }
      )
      if (config.apiUrl) {
        trendRadarClient.setEndpoint(config.apiUrl)
      }

      const prompt = this.buildPrompt(message)
      let body = ''

      if (prompt.includes('新闻') || prompt.includes('热点') || prompt.includes('趋势') || prompt.includes('summary')) {
        const topics = await trendRadarClient.getTrendingTopics(5)
        body =
          topics.length > 0
            ? [
                'TrendRadar 热点简报：',
                ...topics.map(
                  (topic, index) => `${index + 1}. ${topic.title || topic.name || topic.topic || '未知话题'}`
                )
              ].join('\n')
            : 'TrendRadar 当前未获取到可用热点数据。'
      } else {
        const result = await trendRadarClient.searchNews(prompt, 5)
        body =
          result.news.length > 0
            ? [
                'TrendRadar 检索结果：',
                ...result.news.map((item, index) => `${index + 1}. ${item.title} - ${item.platform}`)
              ].join('\n')
            : `未检索到与“${prompt}”相关的热点资讯。`
      }

      const envelope = robotMessageProtocolService.buildEnvelope(message, {
        botName: 'TrendRadar Briefing',
        deliveryMode: message.metadata?.sourceEventId ? 'reply' : 'room',
        securityLevel: 'room'
      })
      const eventId = await robotMessageProtocolService.sendRoomNotice(message.roomId, envelope, body)

      return {
        traceId: message.traceId,
        roomId: message.roomId,
        botId: message.botId,
        delivered: true,
        eventId
      }
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'TrendRadar Briefing 发送失败'
      logger.error(`[TrendRadarBriefing] dispatch failed: ${messageText}`, error)
      return {
        traceId: message.traceId,
        roomId: message.roomId,
        botId: message.botId,
        delivered: false,
        error: messageText
      }
    }
  }
}

export const trendRadarBriefingRoomService = new TrendRadarBriefingRoomService()
