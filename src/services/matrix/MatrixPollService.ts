import matrixClientService from './MatrixClientService'
import { BaseManager } from './BaseManager'
import { info } from '@tauri-apps/plugin-log'

export interface PollOption {
  id: string
  text: string
  votes: string[]
}

export interface PollData {
  question: string
  options: PollOption[]
  isEnded: boolean
  endTime?: number
  totalVotes: number
}

class MatrixPollService extends BaseManager {
  async createPoll(roomId: string, question: string, options: string[], endTime?: number): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Poll] 客户端未初始化')
    }
    const pollOptions = options.map((text, index) => ({
      id: index.toString(),
      text
    }))

    const content: any = {
      msgtype: 'm.poll.start',
      body: question,
      'm.poll': {
        question: {
          text: question
        },
        answers: pollOptions.map((opt) => ({
          id: opt.id,
          text: opt.text
        })),
        kind: 'm.poll.disclosed'
      }
    }

    if (endTime) {
      content['m.poll'].end_time = endTime
    }

    const response = await client.sendEvent(roomId, 'm.room.message', content)
    info(`[Poll] 创建投票成功: ${roomId}`)
    return response.event_id
  }

  async vote(roomId: string, pollEventId: string, optionId: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Poll] 客户端未初始化')
    }
    const content: any = {
      msgtype: 'm.poll.response',
      body: optionId,
      'm.poll.response': {
        answers: [optionId]
      },
      'm.relates_to': {
        rel_type: 'm.reference',
        event_id: pollEventId
      }
    }

    const response = await client.sendEvent(roomId, 'm.room.message', content)
    info(`[Poll] 投票成功: ${pollEventId}`)
    return response.event_id
  }

  async endPoll(roomId: string, pollEventId: string): Promise<string> {
    const client = matrixClientService.getClient()
    if (!client) {
      throw new Error('[Poll] 客户端未初始化')
    }
    const room = client.getRoom(roomId)
    if (!room) {
      throw new Error(`[Poll] 房间不存在: ${roomId}`)
    }

    const pollEvent = room.findEventById(pollEventId)
    if (!pollEvent) {
      throw new Error(`[Poll] 投票不存在: ${pollEventId}`)
    }

    const pollContent = pollEvent.getContent()
    const votes = await this.getVotes(roomId, pollEventId)
    const results = this.calculateResults(
      (pollContent['m.poll'] as { answers: { id: string; text: string }[] })?.answers || [],
      votes
    )

    const content: any = {
      msgtype: 'm.poll.end',
      body: 'Poll ended',
      'm.poll.end': {
        results
      },
      'm.relates_to': {
        rel_type: 'm.reference',
        event_id: pollEventId
      }
    }

    const response = await client.sendEvent(roomId, 'm.room.message', content)
    info(`[Poll] 结束投票成功: ${pollEventId}`)
    return response.event_id
  }

  async getVotes(roomId: string, pollEventId: string): Promise<Map<string, string[]>> {
    const client = matrixClientService.getClient()
    if (!client) return new Map()

    try {
      const room = client.getRoom(roomId)
      if (!room) return new Map()

      const votes = new Map<string, string[]>()
      const timelineSet = room.getUnfilteredTimelineSet()
      const events = timelineSet.getLiveTimeline().getEvents()

      for (const event of events) {
        const content = event.getContent()
        const relatesTo = content['m.relates_to']

        if (content.msgtype === 'm.poll.response' && relatesTo?.event_id === pollEventId) {
          const sender = event.getSender()
          const answers = content['m.poll.response']?.answers || []

          if (sender) {
            votes.set(sender, answers)
          }
        }
      }

      return votes
    } catch {
      return new Map()
    }
  }

  calculateResults(
    options: { id: string; text: string }[],
    votes: Map<string, string[]>
  ): { id: string; text: string; count: number }[] {
    const results = options.map((opt) => ({
      id: opt.id,
      text: opt.text,
      count: 0
    }))

    votes.forEach((userVotes) => {
      for (const voteId of userVotes) {
        const option = results.find((r) => r.id === voteId)
        if (option) {
          option.count++
        }
      }
    })

    return results.sort((a, b) => b.count - a.count)
  }

  parsePollEvent(event: any): PollData | null {
    try {
      const content = event.getContent()
      const poll = content['m.poll']

      if (!poll) return null

      const options: PollOption[] = (poll.answers || []).map((ans: any) => ({
        id: ans.id,
        text: ans.text,
        votes: []
      }))

      return {
        question: poll.question?.text || content.body || '',
        options,
        isEnded: false,
        endTime: poll.end_time,
        totalVotes: 0
      }
    } catch {
      return null
    }
  }
}

export const matrixPollService = new MatrixPollService()
export default matrixPollService
