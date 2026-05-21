import { useRobotCenterStore } from '@/stores/domains/robot/center'

export interface RobotCommandContext {
  roomId: string
  userId?: string
  input: string
}

export interface RobotCommandResult {
  handled: boolean
  message?: string
}

type ParsedBotCommand = {
  command: 'status' | 'summarize' | 'briefing'
  args: string
}

function parseBotCommand(input: string): ParsedBotCommand | null {
  const normalized = input.trim()
  if (!normalized.startsWith('/bot')) {
    return null
  }

  const [, command = '', ...rest] = normalized.split(/\s+/)
  if (!command) {
    return null
  }

  const args = rest.join(' ').trim()
  if (command === 'status' || command === 'summarize' || command === 'briefing') {
    return {
      command,
      args
    }
  }

  return null
}

class RobotCommandService {
  async execute(context: RobotCommandContext): Promise<RobotCommandResult> {
    const parsed = parseBotCommand(context.input)
    if (!parsed) {
      return { handled: false }
    }

    const robotCenterStore = useRobotCenterStore()
    robotCenterStore.ensureBuiltins()

    switch (parsed.command) {
      case 'status': {
        const instance = robotCenterStore.getRoomInstance(context.roomId, 'hula-notifier')
        if (!instance) {
          return { handled: true, message: '当前房间未部署 HuLa Notifier，无法执行 /bot status。' }
        }
        await robotCenterStore.invokeRobot(context.roomId, 'hula-notifier', '请播报当前机器人状态。', {
          userId: context.userId,
          source: 'slash-command',
          command: 'status'
        })
        return { handled: true }
      }
      case 'summarize': {
        const instance = robotCenterStore.getRoomInstance(context.roomId, 'openclaw-assistant')
        if (!instance) {
          return { handled: true, message: '当前房间未部署 OpenClaw Assistant，无法执行 /bot summarize。' }
        }
        await robotCenterStore.invokeRobot(
          context.roomId,
          'openclaw-assistant',
          parsed.args || '请结合最近消息总结本房间的讨论重点。',
          {
            userId: context.userId,
            source: 'slash-command',
            command: 'summarize',
            prompt: parsed.args || '请结合最近消息总结本房间的讨论重点。'
          }
        )
        return { handled: true }
      }
      case 'briefing': {
        const instance = robotCenterStore.getRoomInstance(context.roomId, 'trendradar-briefing')
        if (!instance) {
          return { handled: true, message: '当前房间未部署 TrendRadar Briefing，无法执行 /bot briefing。' }
        }
        await robotCenterStore.invokeRobot(
          context.roomId,
          'trendradar-briefing',
          parsed.args || '请播报当前热点简报。',
          {
            userId: context.userId,
            source: 'slash-command',
            command: 'briefing',
            prompt: parsed.args || '请播报当前热点简报。'
          }
        )
        return { handled: true }
      }
    }
  }
}

export const robotCommandService = new RobotCommandService()
