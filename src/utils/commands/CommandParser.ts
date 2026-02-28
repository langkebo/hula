import matrixClientService from '@/services/matrix/MatrixClientService'
import { info } from '@tauri-apps/plugin-log'

export interface Command {
  name: string
  description: string
  usage: string
  aliases?: string[]
  execute: (roomId: string, args: string[]) => Promise<string | void>
}

interface EmoteContent {
  msgtype: 'm.emote'
  body: string
}

interface NoticeContent {
  msgtype: 'm.notice'
  body: string
}

interface TextContent {
  msgtype: 'm.text'
  body: string
}

class CommandParser {
  private commands: Map<string, Command> = new Map()

  constructor() {
    this.registerBuiltInCommands()
  }

  private registerBuiltInCommands(): void {
    this.registerCommand({
      name: 'me',
      description: '发送动作消息',
      usage: '/me <动作>',
      execute: async (roomId: string, args: string[]) => {
        const action = args.join(' ')
        if (!action) throw new Error('请输入动作内容')

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        const content: EmoteContent = {
          msgtype: 'm.emote',
          body: action
        }

        const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
        return response.event_id
      }
    })

    this.registerCommand({
      name: 'notice',
      description: '发送通知消息',
      usage: '/notice <消息>',
      aliases: ['n'],
      execute: async (roomId: string, args: string[]) => {
        const message = args.join(' ')
        if (!message) throw new Error('请输入消息内容')

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        const content: NoticeContent = {
          msgtype: 'm.notice',
          body: message
        }

        const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
        return response.event_id
      }
    })

    this.registerCommand({
      name: 'shrug',
      description: '发送耸肩表情',
      usage: '/shrug [消息]',
      execute: async (roomId: string, args: string[]) => {
        const message = args.length > 0 ? `${args.join(' ')} ¯\\_(ツ)_/¯` : '¯\\_(ツ)_/¯'

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        const content: TextContent = {
          msgtype: 'm.text',
          body: message
        }

        const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
        return response.event_id
      }
    })

    this.registerCommand({
      name: 'tableflip',
      description: '发送翻桌表情',
      usage: '/tableflip [消息]',
      execute: async (roomId: string, args: string[]) => {
        const message = args.length > 0 ? `${args.join(' ')} (╯°□°）╯︵ ┻━┻` : '(╯°□°）╯︵ ┻━┻'

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        const content: TextContent = {
          msgtype: 'm.text',
          body: message
        }

        const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
        return response.event_id
      }
    })

    this.registerCommand({
      name: 'unflip',
      description: '发送扶桌表情',
      usage: '/unflip [消息]',
      execute: async (roomId: string, args: string[]) => {
        const message = args.length > 0 ? `${args.join(' ')} ┬─┬ ノ( ゜-゜ノ)` : '┬─┬ ノ( ゜-゜ノ)'

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        const content: TextContent = {
          msgtype: 'm.text',
          body: message
        }

        const response = await client.sendEvent(roomId, 'm.room.message' as any, content)
        return response.event_id
      }
    })

    this.registerCommand({
      name: 'topic',
      description: '设置房间主题',
      usage: '/topic <主题>',
      execute: async (roomId: string, args: string[]) => {
        const topic = args.join(' ')
        if (!topic) throw new Error('请输入主题内容')

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        await client.sendStateEvent(roomId, 'm.room.topic' as any, { topic }, '')
        info(`[Command] 设置房间主题: ${roomId}`)
      }
    })

    this.registerCommand({
      name: 'invite',
      description: '邀请用户加入房间',
      usage: '/invite <用户ID>',
      execute: async (roomId: string, args: string[]) => {
        const userId = args[0]
        if (!userId || !userId.startsWith('@')) {
          throw new Error('请输入有效的用户ID (格式: @用户名:服务器)')
        }

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        await client.invite(roomId, userId)
        info(`[Command] 邀请用户: ${userId} -> ${roomId}`)
      }
    })

    this.registerCommand({
      name: 'join',
      description: '加入房间',
      usage: '/join <房间ID或别名>',
      aliases: ['j'],
      execute: async (_roomId: string, args: string[]) => {
        const roomAlias = args[0]
        if (!roomAlias) throw new Error('请输入房间ID或别名')

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        await client.joinRoom(roomAlias)
        info(`[Command] 加入房间: ${roomAlias}`)
      }
    })

    this.registerCommand({
      name: 'leave',
      description: '离开房间',
      usage: '/leave',
      aliases: ['part'],
      execute: async (roomId: string) => {
        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        await client.leave(roomId)
        info(`[Command] 离开房间: ${roomId}`)
      }
    })

    this.registerCommand({
      name: 'kick',
      description: '踢出用户',
      usage: '/kick <用户ID> [原因]',
      execute: async (roomId: string, args: string[]) => {
        const userId = args[0]
        const reason = args.slice(1).join(' ')

        if (!userId || !userId.startsWith('@')) {
          throw new Error('请输入有效的用户ID')
        }

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        await client.kick(roomId, userId, reason)
        info(`[Command] 踢出用户: ${userId} <- ${roomId}`)
      }
    })

    this.registerCommand({
      name: 'ban',
      description: '封禁用户',
      usage: '/ban <用户ID> [原因]',
      execute: async (roomId: string, args: string[]) => {
        const userId = args[0]
        const reason = args.slice(1).join(' ')

        if (!userId || !userId.startsWith('@')) {
          throw new Error('请输入有效的用户ID')
        }

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        await client.ban(roomId, userId, reason)
        info(`[Command] 封禁用户: ${userId} <- ${roomId}`)
      }
    })

    this.registerCommand({
      name: 'unban',
      description: '解封用户',
      usage: '/unban <用户ID>',
      execute: async (roomId: string, args: string[]) => {
        const userId = args[0]

        if (!userId || !userId.startsWith('@')) {
          throw new Error('请输入有效的用户ID')
        }

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        await client.unban(roomId, userId)
        info(`[Command] 解封用户: ${userId} <- ${roomId}`)
      }
    })

    this.registerCommand({
      name: 'op',
      description: '设置用户权限等级',
      usage: '/op <用户ID> <等级>',
      execute: async (roomId: string, args: string[]) => {
        const userId = args[0]
        const level = parseInt(args[1], 10)

        if (!userId || !userId.startsWith('@')) {
          throw new Error('请输入有效的用户ID')
        }

        if (isNaN(level)) {
          throw new Error('请输入有效的权限等级')
        }

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        await client.setPowerLevel(roomId, userId, level)
        info(`[Command] 设置权限: ${userId} -> ${level}`)
      }
    })

    this.registerCommand({
      name: 'nick',
      description: '设置显示名称',
      usage: '/nick <新名称>',
      execute: async (_roomId: string, args: string[]) => {
        const displayName = args.join(' ')
        if (!displayName) throw new Error('请输入新名称')

        const client = matrixClientService.getClient()
        if (!client) throw new Error('客户端未初始化')

        await client.setDisplayName(displayName)
        info(`[Command] 设置名称: ${displayName}`)
      }
    })

    this.registerCommand({
      name: 'help',
      description: '显示帮助信息',
      usage: '/help [命令名]',
      execute: async () => {
        return 'help'
      }
    })
  }

  registerCommand(command: Command): void {
    this.commands.set(command.name.toLowerCase(), command)
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.commands.set(alias.toLowerCase(), command)
      }
    }
  }

  parse(input: string): { command: string; args: string[] } | null {
    const trimmed = input.trim()
    if (!trimmed.startsWith('/')) return null

    const parts = trimmed.slice(1).split(/\s+/)
    const command = parts[0]?.toLowerCase()
    const args = parts.slice(1)

    if (!command) return null

    return { command, args }
  }

  async execute(roomId: string, input: string): Promise<string | void> {
    const parsed = this.parse(input)
    if (!parsed) return

    const { command, args } = parsed
    const cmd = this.commands.get(command)

    if (!cmd) {
      throw new Error(`未知命令: /${command}。输入 /help 查看可用命令。`)
    }

    return cmd.execute(roomId, args)
  }

  getCommands(): Command[] {
    const seen = new Set<string>()
    const commands: Command[] = []

    for (const cmd of this.commands.values()) {
      if (!seen.has(cmd.name)) {
        seen.add(cmd.name)
        commands.push(cmd)
      }
    }

    return commands.sort((a, b) => a.name.localeCompare(b.name))
  }

  getCommand(name: string): Command | undefined {
    return this.commands.get(name.toLowerCase())
  }

  isCommand(input: string): boolean {
    return input.trim().startsWith('/')
  }

  getCompletions(partial: string): Command[] {
    if (!partial.startsWith('/')) return []

    const prefix = partial.slice(1).toLowerCase()
    const seen = new Set<string>()
    const completions: Command[] = []

    for (const [name, cmd] of this.commands) {
      if (name.startsWith(prefix) && !seen.has(cmd.name)) {
        seen.add(cmd.name)
        completions.push(cmd)
      }
    }

    return completions
  }
}

export const commandParser = new CommandParser()
export default commandParser
