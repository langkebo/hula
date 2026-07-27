import type { VideoGenerationRequest } from '@/services/matrix/ai/AIService'

interface ParsedGenerationSize {
  width: number
  height: number
}

interface BuildImageGenerationRequestOptions {
  modelId: string
  prompt: string
  size: string
  conversationId: string
}

interface BuildVideoGenerationRequestOptions {
  modelId: string
  prompt: string
  size: string
  duration: number
  conversationId: string
  image?: string | null
}

interface BuildAudioGenerationRequestOptions {
  modelId: string
  prompt: string
  conversationId: string
  voice: string
  speed: number
}

const parseDimensionPart = (value: string | undefined, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const parseGenerationSize = (size: string, fallback: ParsedGenerationSize = { width: 1024, height: 1024 }) => {
  const [rawWidth, rawHeight] = String(size || '').split('x')

  return {
    width: parseDimensionPart(rawWidth, fallback.width),
    height: parseDimensionPart(rawHeight, fallback.height)
  }
}

export const buildImageGenerationRequest = ({
  modelId,
  prompt,
  size,
  conversationId
}: BuildImageGenerationRequestOptions) => {
  const { width, height } = parseGenerationSize(size)

  return {
    request: {
      modelId,
      prompt,
      width,
      height,
      conversationId
    },
    size: {
      width,
      height
    }
  }
}

export const buildVideoGenerationRequest = ({
  modelId,
  prompt,
  size,
  duration,
  conversationId,
  image
}: BuildVideoGenerationRequestOptions) => {
  const { width, height } = parseGenerationSize(size, { width: 1280, height: 720 })
  const request: VideoGenerationRequest = {
    modelId,
    prompt,
    width,
    height,
    duration,
    conversationId
  }

  if (image) {
    request.options = { image }
  }

  return {
    request,
    size: {
      width,
      height
    }
  }
}

export const buildAudioGenerationRequest = ({
  modelId,
  prompt,
  conversationId,
  voice,
  speed
}: BuildAudioGenerationRequestOptions) => ({
  modelId,
  prompt,
  conversationId,
  options: {
    voice,
    speed: String(speed)
  }
})
