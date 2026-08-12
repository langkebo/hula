/**
 * MSC4108 QR 登录 — 辅助函数模块。
 *
 * 从 MatrixQrLoginSdkService 抽离的纯函数：base64 转换、设备 ID 生成、
 * SDK 懒加载、HTTP 请求封装。
 */

import { resolveMatrixRuntimeEndpointConfig } from '@/services/backend/config'
import { getRuntimeAwareFetch } from '@/services/matrix/network/runtimeFetch'
import { createLogger } from '@/utils/Logger'
import { matrixHttpClient } from '../MatrixHttpClient'
import { PREFIX_V3 } from '../paths'
import type { SdkRendezvousModule } from './qrLoginTypes'

const logger = createLogger('QrLoginHelpers')

let sdkModulePromise: Promise<SdkRendezvousModule> | null = null

export async function loadSdkRendezvous(): Promise<SdkRendezvousModule> {
  if (!sdkModulePromise) {
    sdkModulePromise = import('matrix-js-sdk/rendezvous').then((mod) => ({
      MSC4108RendezvousSession: mod.MSC4108RendezvousSession,
      MSC4108SecureChannel: mod.MSC4108SecureChannel
    })) as Promise<SdkRendezvousModule>
  }
  return sdkModulePromise
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function generateDeviceId(): string {
  const random = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(random)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

export { getRuntimeAwareFetch, logger, resolveMatrixRuntimeEndpointConfig }

/**
 * FT-087: 通过 matrixHttpClient 发送未认证的 POST 请求（走 SDK 基础设施：重试、URL 解析）。
 */
export async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return matrixHttpClient.request<T>('POST', path, { body })
}

export { PREFIX_V3 }
