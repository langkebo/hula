/**
 * Matrix API 类型定义
 * 用于替代服务层的 any[] 和 Record<string, any> 类型
 */

// ==================== AI 服务相关类型 ====================

import type { AIModel } from '@/services/matrix/ai/ModelService'

export type { AIModel }

export interface AIModelListResponse {
  list: AIModel[]
  total: number
}

export interface AIImage {
  id: string
  url: string
  picUrl?: string
  width: number
  height: number
  format: 'png' | 'jpg' | 'webp' | 'gif'
  size: number
  createdAt: number
  status?: number
  errorMessage?: string
}

export interface AIImageListResponse {
  list: AIImage[]
  total: number
}

export interface AIVideo {
  id: string
  url: string
  videoUrl?: string
  width: number
  height: number
  duration: number
  format: 'mp4' | 'webm' | 'mov'
  size: number
  createdAt: number
  status?: number
  errorMessage?: string
}

export interface AIVideoListResponse {
  list: AIVideo[]
  total: number
}

export interface AIAudio {
  id: string
  url: string
  audioUrl?: string
  duration: number
  format: 'mp3' | 'wav' | 'ogg' | 'm4a'
  size: number
  createdAt: number
  status?: number
  errorMessage?: string
}

export interface AIAudioListResponse {
  list: AIAudio[]
  total: number
}

export interface AIVoice {
  id: string
  name: string
  language: string
  gender: 'male' | 'female' | 'neutral'
  preview?: string
}

export interface AIChatRole {
  id: string
  name: string
  description?: string
  avatar?: string
  systemPrompt?: string
  model?: string
  createdAt: number
}

export interface AIChatRoleListResponse {
  list: AIChatRole[]
  total: number
}

// ==================== 搜索服务相关类型 ====================

export interface SearchEventContext {
  eventsBefore: SearchEvent[]
  eventsAfter: SearchEvent[]
}

export interface SearchEvent {
  eventId: string
  roomId: string
  sender: string
  type: string
  content: Record<string, unknown>
  originServerTs: number
}

// ==================== 管理服务相关类型 ====================

// ==================== 审核服务相关类型 ====================

// ==================== Widget 服务相关类型 ====================

// ==================== VoIP 服务相关类型 ====================

// ==================== 表情包服务相关类型 ====================

// ==================== 消息服务相关类型 ====================

// ==================== 服务器通知相关类型 ====================

// ==================== 脱水设备相关类型 ====================

// ==================== 扩展服务相关类型 ====================

// ==================== 分页请求参数 ====================

// ==================== 消息服务相关类型 ====================
