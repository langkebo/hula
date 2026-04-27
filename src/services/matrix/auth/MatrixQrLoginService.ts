/**
 * Matrix QR 登录服务
 *
 * 基于本地存储维护扫码登录会话，作为新后端适配期间的本地 SDK 桥接层。
 */

import { ref, computed } from 'vue'
import { useMatrixStore } from '@/stores/domains/chat/matrix'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('QRLogin')
const STORAGE_KEY_PREFIX = 'matrix_qr_login_session:'
const CURRENT_QR_ID_KEY = 'matrix_qr_login_current'
const QR_EXPIRE_MS = 5 * 60 * 1000

export type QRLoginStatus =
  | 'idle'
  | 'generating'
  | 'waiting_scan'
  | 'waiting_confirm'
  | 'success'
  | 'expired'
  | 'failed'

export interface QRCodeResult {
  qrId?: string
  qrCode?: string
  code?: string
  status?: string
}

export interface QRLoginState {
  status: QRLoginStatus
  qrId?: string
  qrCode?: string
  error?: string
}

export interface QRLoginResult {
  qrId?: string
  qrCode?: string
  status?: string
  userId?: string
  accessToken?: string
  refreshToken?: string
  deviceId?: string
  ip?: string
  expireTime?: string
  deviceType?: string
  locPlace?: string
  data?: {
    uid: string
    token: string
    refreshToken: string
    deviceId?: string
  }
}

export interface UseQRLoginOptions {
  onStatusChange?: (status: QRLoginStatus) => void
  onSuccess?: (result: QRLoginResult) => void
  onError?: (error: string) => void
  pollInterval?: number
  maxRetries?: number
}

export function useQRLogin(options: UseQRLoginOptions = {}) {
  const state = ref<QRLoginState & QRLoginResult>({
    status: 'idle'
  })

  const status = computed(() => state.value.status)
  const isConnected = computed(() => state.value.status === 'success')
  const error = computed(() => state.value.error)

  interface StoredQRSession {
    qrId: string
    status: 'PENDING' | 'SCANNED' | 'CONFIRMED' | 'EXPIRED'
    createdAt: number
    expireAt: number
    ip: string
    deviceType: string
    locPlace: string
    userId?: string
    accessToken?: string
    refreshToken?: string
    deviceId?: string
  }

  function createQrId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
    return `qr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  }

  function getStorageKey(qrId: string): string {
    return `${STORAGE_KEY_PREFIX}${qrId}`
  }

  function saveSession(session: StoredQRSession) {
    localStorage.setItem(getStorageKey(session.qrId), JSON.stringify(session))
    localStorage.setItem(CURRENT_QR_ID_KEY, session.qrId)
  }

  function normalizeSession(session: StoredQRSession | null): StoredQRSession | null {
    if (!session) {
      return null
    }

    if (Date.now() > session.expireAt && session.status !== 'CONFIRMED') {
      const expiredSession: StoredQRSession = {
        ...session,
        status: 'EXPIRED'
      }
      saveSession(expiredSession)
      return expiredSession
    }

    return session
  }

  function readSession(qrId?: string): StoredQRSession | null {
    const targetQrId = qrId || localStorage.getItem(CURRENT_QR_ID_KEY) || state.value.qrId
    if (!targetQrId) {
      return null
    }

    const raw = localStorage.getItem(getStorageKey(targetQrId))
    if (!raw) {
      return null
    }

    try {
      return normalizeSession(JSON.parse(raw) as StoredQRSession)
    } catch (error) {
      logger.warn('解析二维码登录会话失败:', error)
      localStorage.removeItem(getStorageKey(targetQrId))
      return null
    }
  }

  function mapSessionToResult(session: StoredQRSession): QRLoginResult {
    return {
      qrId: session.qrId,
      qrCode: session.qrId,
      status: session.status,
      userId: session.userId,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      deviceId: session.deviceId,
      ip: session.ip,
      expireTime: String(session.expireAt),
      deviceType: session.deviceType,
      locPlace: session.locPlace,
      data:
        session.status === 'CONFIRMED' && session.userId && session.accessToken
          ? {
              uid: session.userId,
              token: session.accessToken,
              refreshToken: session.refreshToken || '',
              deviceId: session.deviceId
            }
          : undefined
    }
  }

  function updateStateFromSession(session: StoredQRSession) {
    state.value.qrId = session.qrId
    state.value.qrCode = session.qrId
    state.value.ip = session.ip
    state.value.expireTime = String(session.expireAt)
    state.value.deviceType = session.deviceType
    state.value.locPlace = session.locPlace
  }

  function createPendingSession(): StoredQRSession {
    const qrId = createQrId()
    return {
      qrId,
      status: 'PENDING',
      createdAt: Date.now(),
      expireAt: Date.now() + QR_EXPIRE_MS,
      ip: 'local-device',
      deviceType: getDeviceType(),
      locPlace: '当前设备'
    }
  }

  async function generateQR(): Promise<QRLoginResult | null> {
    try {
      state.value.status = 'generating'
      state.value.error = undefined
      const session = createPendingSession()
      saveSession(session)
      updateStateFromSession(session)
      state.value.status = 'waiting_scan'
      options.onStatusChange?.('waiting_scan')
      return mapSessionToResult(session)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'QR码生成失败'
      state.value.status = 'failed'
      state.value.error = errorMessage
      options.onError?.(errorMessage)
      return null
    }
  }

  async function checkStatus(qrId?: string): Promise<QRLoginResult | null> {
    const session = readSession(qrId)
    if (!session) {
      handleExpired(qrId)
      return null
    }

    updateStateFromSession(session)

    switch (session.status) {
      case 'PENDING':
        state.value.status = 'waiting_scan'
        options.onStatusChange?.('waiting_scan')
        break
      case 'SCANNED':
        state.value.status = 'waiting_confirm'
        options.onStatusChange?.('waiting_confirm')
        break
      case 'CONFIRMED': {
        state.value.status = 'success'
        const result = mapSessionToResult(session)
        options.onStatusChange?.('success')
        options.onSuccess?.(result)
        return result
      }
      case 'EXPIRED':
        handleExpired(session.qrId)
        return mapSessionToResult(session)
      default:
        break
    }

    return mapSessionToResult(session)
  }

  async function handleScan(qrId?: string): Promise<QRLoginResult | null> {
    const session = readSession(qrId)
    if (!session) {
      return null
    }

    if (session.status === 'EXPIRED') {
      handleExpired(session.qrId)
      return mapSessionToResult(session)
    }

    try {
      const nextSession: StoredQRSession = {
        ...session,
        status: 'SCANNED'
      }
      saveSession(nextSession)
      updateStateFromSession(nextSession)
      state.value.status = 'waiting_confirm'
      options.onStatusChange?.('waiting_confirm')
      return mapSessionToResult(nextSession)
    } catch (err) {
      logger.error('扫码失败:', err)
      return null
    }
  }

  async function handleConfirm(qrId?: string): Promise<boolean> {
    const session = readSession(qrId)
    if (!session) {
      return false
    }

    try {
      const matrixStore = useMatrixStore()
      if (!matrixStore.userId || !matrixStore.accessToken) {
        throw new Error('当前设备未登录，无法确认二维码登录')
      }

      const confirmedSession: StoredQRSession = {
        ...session,
        status: 'CONFIRMED',
        userId: matrixStore.userId,
        accessToken: matrixStore.accessToken,
        refreshToken: '',
        deviceId: matrixStore.deviceId || undefined
      }

      saveSession(confirmedSession)
      updateStateFromSession(confirmedSession)
      state.value.status = 'success'
      const result = mapSessionToResult(confirmedSession)
      options.onStatusChange?.('success')
      options.onSuccess?.(result)
      return true
    } catch (err) {
      logger.error('确认登录失败:', err)
      state.value.error = '确认登录失败'
      return false
    }
  }

  function handleExpired(qrId?: string) {
    const session = readSession(qrId)
    if (session && session.status !== 'EXPIRED') {
      saveSession({
        ...session,
        status: 'EXPIRED'
      })
    }
    state.value.status = 'expired'
    state.value.error = '二维码已过期，请刷新'
    options.onStatusChange?.('expired')
    options.onError?.('二维码已过期，请刷新')
  }

  async function refresh(): Promise<QRLoginResult | null> {
    state.value.status = 'idle'
    return await generateQR()
  }

  function reset() {
    state.value = {
      status: 'idle'
    }
  }

  function getSession(qrId?: string): QRLoginResult | null {
    const session = readSession(qrId)
    return session ? mapSessionToResult(session) : null
  }

  function getDeviceType(): string {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    return isMobile ? 'MOBILE' : 'PC'
  }

  return {
    state,
    status,
    isConnected,
    error,
    generateQR,
    refresh,
    reset,
    getSession,
    handleScan,
    handleConfirm,
    checkStatus
  }
}

export const matrixQrLoginService = useQRLogin()
