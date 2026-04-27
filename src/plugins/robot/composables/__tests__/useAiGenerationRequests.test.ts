import { describe, expect, it } from 'vitest'
import {
  buildAudioGenerationRequest,
  buildImageGenerationRequest,
  buildVideoGenerationRequest,
  parseGenerationSize
} from '../useAiGenerationRequests'

describe('useAiGenerationRequests', () => {
  it('parseGenerationSize parses width and height from size string', () => {
    expect(parseGenerationSize('1536x1024')).toEqual({
      width: 1536,
      height: 1024
    })
  })

  it('parseGenerationSize falls back when size is invalid', () => {
    expect(parseGenerationSize('bad-input')).toEqual({
      width: 1024,
      height: 1024
    })
  })

  it('buildImageGenerationRequest returns request and parsed size', () => {
    expect(
      buildImageGenerationRequest({
        modelId: 'img-model',
        prompt: 'draw a fox',
        size: '1024x768',
        conversationId: 'chat-1'
      })
    ).toEqual({
      request: {
        modelId: 'img-model',
        prompt: 'draw a fox',
        width: 1024,
        height: 768,
        conversationId: 'chat-1'
      },
      size: {
        width: 1024,
        height: 768
      }
    })
  })

  it('buildVideoGenerationRequest keeps optional image only when provided', () => {
    expect(
      buildVideoGenerationRequest({
        modelId: 'vid-model',
        prompt: 'animate it',
        size: '1280x720',
        duration: 5,
        conversationId: 'chat-2',
        image: 'https://cdn/source.png'
      })
    ).toEqual({
      request: {
        modelId: 'vid-model',
        prompt: 'animate it',
        width: 1280,
        height: 720,
        duration: 5,
        conversationId: 'chat-2',
        options: {
          image: 'https://cdn/source.png'
        }
      },
      size: {
        width: 1280,
        height: 720
      }
    })
  })

  it('buildAudioGenerationRequest stringifies speed for API payload', () => {
    expect(
      buildAudioGenerationRequest({
        modelId: 'aud-model',
        prompt: 'read this',
        conversationId: 'chat-3',
        voice: 'nova',
        speed: 1.25
      })
    ).toEqual({
      modelId: 'aud-model',
      prompt: 'read this',
      conversationId: 'chat-3',
      options: {
        voice: 'nova',
        speed: '1.25'
      }
    })
  })
})
