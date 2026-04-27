import { describe, expect, it } from 'vitest'
import { MsgEnum } from '@/enums'
import { VoiceMessageStrategyImpl } from '../voice'

describe('VoiceMessageStrategyImpl', () => {
  const strategy = new VoiceMessageStrategyImpl()

  it('uses MsgEnum.VOICE as msgType', () => {
    expect(strategy.msgType).toBe(MsgEnum.VOICE)
  })

  it('buildMessageBody rounds duration to second', () => {
    const body = strategy.buildMessageBody({
      type: MsgEnum.VOICE,
      url: 'asset:///tmp/v.mp3',
      size: 12345,
      duration: 3.7,
      filename: 'v.mp3',
      mimeType: 'audio/mpeg'
    })
    expect(body).toEqual({
      url: 'asset:///tmp/v.mp3',
      size: 12345,
      second: 4,
      fileName: 'v.mp3',
      mimeType: 'audio/mpeg'
    })
  })

  it('buildMessageBody floors integer durations correctly', () => {
    const body = strategy.buildMessageBody({
      type: MsgEnum.VOICE,
      url: 'u',
      size: 0,
      duration: 5.4,
      filename: 'a',
      mimeType: 'audio/wav'
    })
    expect(body.second).toBe(5)
  })

  it('getMsg reads dataset from a .voice-message-placeholder element', () => {
    document.body.innerHTML = ''
    const div = document.createElement('div')
    div.className = 'voice-message-placeholder'
    div.dataset.url = '/tmp/v.mp3'
    div.dataset.size = '2048'
    div.dataset.duration = '6.2'
    div.dataset.filename = 'voice.mp3'
    div.dataset.mimeType = 'audio/mpeg'
    document.body.appendChild(div)

    const msg = strategy.getMsg() as Record<string, unknown>
    expect(msg.type).toBe(MsgEnum.VOICE)
    expect(msg.localPath).toBe('/tmp/v.mp3')
    expect(msg.url).toBe('asset:///tmp/v.mp3')
    expect(msg.size).toBe(2048)
    expect(msg.duration).toBeCloseTo(6.2)
    expect(msg.filename).toBe('voice.mp3')
    expect(msg.mimeType).toBe('audio/mpeg')
    document.body.innerHTML = ''
  })

  it('getMsg falls back to defaults for missing dataset', () => {
    document.body.innerHTML = ''
    const div = document.createElement('div')
    div.className = 'voice-message-placeholder'
    document.body.appendChild(div)
    const msg = strategy.getMsg() as Record<string, unknown>
    expect(msg.localPath).toBe('')
    expect(msg.url).toBe('asset://')
    expect(msg.size).toBe(0)
    expect(msg.duration).toBe(0)
    expect(msg.filename).toBe('voice.mp3')
    expect(msg.mimeType).toBe('audio/mpeg')
    document.body.innerHTML = ''
  })

  it('getMsg picks the last placeholder when multiple exist', () => {
    document.body.innerHTML = ''
    const a = document.createElement('div')
    a.className = 'voice-message-placeholder'
    a.dataset.url = '/a.mp3'
    const b = document.createElement('div')
    b.className = 'voice-message-placeholder'
    b.dataset.url = '/b.mp3'
    document.body.appendChild(a)
    document.body.appendChild(b)

    const msg = strategy.getMsg() as Record<string, unknown>
    expect(msg.localPath).toBe('/b.mp3')
    document.body.innerHTML = ''
  })
})
