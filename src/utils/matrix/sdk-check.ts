/**
 * Matrix SDK 版本检查工具
 */

import * as matrixSdk from 'matrix-js-sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('SdkCheck')

// 定义 SDK 类型以包含 VERSION 属性
interface MatrixSdkWithVersion {
  VERSION?: string
  [key: string]: unknown
}

const sdk = matrixSdk as MatrixSdkWithVersion

/**
 * SDK 最低版本要求
 */
export const MIN_SDK_VERSION = '30.0.0'

/**
 * SDK 最高版本要求
 */
export const MAX_SDK_VERSION = '40.0.0'

/**
 * SDK 版本信息
 */
export interface SdkVersionInfo {
  version: string
  isCompatible: boolean
  isSupported: boolean
  warning?: string
}

/**
 * 获取 SDK 版本信息
 */
export function getSdkVersionInfo(): SdkVersionInfo {
  // 尝试获取 SDK 版本，如果不可用则使用默认值
  let version = 'unknown'
  try {
    version = sdk.VERSION || 'unknown'
  } catch (_e) {
    // 版本获取失败
  }

  // 解析版本号
  const currentParts = version.split('.').map(Number)
  const minParts = MIN_SDK_VERSION.split('.').map(Number)
  const maxParts = MAX_SDK_VERSION.split('.').map(Number)

  // 比较版本
  const isAboveMin = compareVersions(currentParts, minParts) >= 0
  const isBelowMax = compareVersions(currentParts, maxParts) <= 0

  const isCompatible = isAboveMin && isBelowMax
  const isSupported = isCompatible

  let warning: string | undefined

  if (!isAboveMin) {
    warning = `SDK 版本 ${version} 低于最低要求 ${MIN_SDK_VERSION}，某些功能可能无法正常工作`
  } else if (!isBelowMax) {
    warning = `SDK 版本 ${version} 高于测试版本 ${MAX_SDK_VERSION}，可能存在兼容性问题`
  }

  return {
    version,
    isCompatible,
    isSupported,
    warning
  }
}

/**
 * 比较版本号
 * @returns -1 (小于), 0 (等于), 1 (大于)
 */
function compareVersions(current: number[], required: number[]): number {
  for (let i = 0; i < Math.max(current.length, required.length); i++) {
    const curr = current[i] || 0
    const req = required[i] || 0

    if (curr < req) return -1
    if (curr > req) return 1
  }
  return 0
}

/**
 * 检查 SDK 版本并在不兼容时抛出错误
 */
export function checkSdkVersion(): void {
  const info = getSdkVersionInfo()

  if (!info.isSupported) {
    if (info.warning) {
      logger.warn(info.warning)
    }

    if (!info.isCompatible) {
      throw new Error(`Matrix SDK 版本不兼容: ${info.version} (要求: ${MIN_SDK_VERSION} - ${MAX_SDK_VERSION})`)
    }
  }

  if (info.warning) {
    logger.warn(info.warning)
  }

  logger.debug('版本检查通过:', info.version)
}

/**
 * 获取 MatrixClient 构造函数的可用参数
 */
export function getClientOptions() {
  return {
    // 基础选项
    baseUrl: '',
    accessToken: '',
    userId: '',

    // 存储选项
    store: undefined as unknown, // MemoryStore, IndexedDBStore

    // 加密选项
    cryptoStore: undefined as unknown,
    verificationLocalDeviceStorageKey: undefined as string | undefined,

    // 同步选项
    initialSyncLimit: 20,
    includeArchivedRooms: false,
    resolveInvitesAsStates: true,
    lazyLoadMembers: true,
    pendingEventOrdering: 'detached',

    // 客户端选项
    request: undefined as unknown,
    timer: undefined as unknown,
    localTimeoutSeconds: undefined as number | undefined,

    // 设备选项
    deviceId: undefined as string | undefined,

    // 高级选项
    unstableClientRelationAggregation: true,
    matrixClient: undefined as unknown,
    forceTURN: false,
    ICE_SERVERS: [] as RTCIceServer[],
    loggingHook: undefined as ((message: string) => void) | undefined
  }
}

/**
 * 初始化 SDK 前的准备工作
 */
export function beforeCreateClient(): void {
  // 检查版本
  checkSdkVersion()

  logger.debug('初始化前检查完成')
}

export default {
  MIN_SDK_VERSION,
  MAX_SDK_VERSION,
  getSdkVersionInfo,
  checkSdkVersion,
  getClientOptions,
  beforeCreateClient
}
