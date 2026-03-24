/**
 * Matrix QR 登录服务
 *
 * 封装 Matrix QR Login 协议的 SDK 调用
 * 参考: https://matrix.org/docs/spec/client_server/r0.6.1# qr-code-login
 */

import { ref, computed } from 'vue'
import { generateQRCode, checkQRStatus, scanQRCodeAPI, confirmQRCodeAPI } from '@/utils/ImRequestUtils'

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
  deviceId?: string
  ip?: string
  expireTime?: string
  deviceType?: string
  locPlace?: string
}

export interface UseQRLoginOptions {
  onStatusChange?: (status: QRLoginStatus) => void
  onSuccess?: (result: QRLoginResult) => void
  onError?: (error: string) => void
  pollInterval?: number
  maxRetries?: number
}

export function useQRLogin(options: UseQRLoginOptions = {}) {
  const pollInterval = options.pollInterval || 2000
  const maxRetries = options.maxRetries || 150

  const state = ref<QRLoginState & QRLoginResult>({
    status: 'idle'
  })

  let pollTimer: number | null = null
  let retryCount = 0

  const status = computed(() => state.value.status)
  const isConnected = computed(() => state.value.status === 'success')
  const error = computed(() => state.value.error)

  async function generateQR(): Promise<QRLoginResult | null> {
    try {
      state.value.status = 'generating'
      state.value.error = undefined
      retryCount = 0

      const result = await generateQRCode()

      if (result && Array.isArray(result) && result.length > 0) {
        const qrData = result[0] as any
        state.value.qrId = qrData.qrId
        state.value.qrCode = qrData.qrCode || qrData.code
        state.value.ip = qrData.ip
        state.value.expireTime = qrData.expireTime
        state.value.deviceType = qrData.deviceType
        state.value.locPlace = qrData.locPlace
        state.value.status = 'waiting_scan'
        options.onStatusChange?.('waiting_scan')

        startPolling()
        return {
          qrId: state.value.qrId,
          qrCode: state.value.qrCode,
          ip: state.value.ip,
          expireTime: state.value.expireTime,
          deviceType: state.value.deviceType,
          locPlace: state.value.locPlace
        }
      }

      throw new Error('QR码生成失败')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'QR码生成失败'
      state.value.status = 'failed'
      state.value.error = errorMessage
      options.onError?.(errorMessage)
      return null
    }
  }

  function startPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
    }

    pollTimer = window.setInterval(async () => {
      await checkStatus()
    }, pollInterval)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  async function checkStatus() {
    if (!state.value.qrId) return

    try {
      const result = await checkQRStatus({
        qrId: state.value.qrId,
        clientId: getClientId(),
        deviceHash: getDeviceHash(),
        deviceType: getDeviceType()
      })

      if (!result || !Array.isArray(result) || result.length === 0) {
        handleExpired()
        return
      }

      const scanResult = result[0] as any

      if (scanResult.qrCode === 'scanned') {
        if (state.value.status !== 'waiting_confirm') {
          state.value.status = 'waiting_confirm'
          options.onStatusChange?.('waiting_confirm')
        }
      } else if (scanResult.qrCode === 'confirmed') {
        stopPolling()
        state.value.status = 'success'
        options.onStatusChange?.('success')
        options.onSuccess?.(scanResult)
      } else if (scanResult.qrCode === 'expired') {
        handleExpired()
      }

      retryCount = 0
    } catch (_err) {
      retryCount++

      if (retryCount >= maxRetries) {
        handleExpired()
      }
    }
  }

  async function handleScan(qrId?: string): Promise<boolean> {
    const finalQrId = qrId || state.value.qrId
    if (!finalQrId) return false

    try {
      await scanQRCodeAPI({ qrId: finalQrId })
      state.value.status = 'waiting_confirm'
      options.onStatusChange?.('waiting_confirm')
      return true
    } catch (err) {
      console.error('[QRLogin] 扫码失败:', err)
      return false
    }
  }

  async function handleConfirm(): Promise<boolean> {
    if (!state.value.qrId) return false

    try {
      const result = await confirmQRCodeAPI({ qrId: state.value.qrId })

      if (result) {
        stopPolling()
        state.value.status = 'success'
        options.onStatusChange?.('success')
        options.onSuccess?.(result)
        return true
      }

      return false
    } catch (err) {
      console.error('[QRLogin] 确认登录失败:', err)
      state.value.error = '确认登录失败'
      return false
    }
  }

  function handleExpired() {
    stopPolling()
    state.value.status = 'expired'
    state.value.error = '二维码已过期，请刷新'
    options.onStatusChange?.('expired')
    options.onError?.('二维码已过期，请刷新')
  }

  async function refresh(): Promise<QRLoginResult | null> {
    stopPolling()
    state.value.status = 'idle'
    return await generateQR()
  }

  function reset() {
    stopPolling()
    state.value = {
      status: 'idle'
    }
    retryCount = 0
  }

  function getClientId(): string {
    try {
      const stored = localStorage.getItem('client_id')
      if (stored) return stored
      const id = `HULA_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      localStorage.setItem('client_id', id)
      return id
    } catch {
      return `HULA_${Date.now()}`
    }
  }

  function getDeviceHash(): string {
    try {
      const stored = localStorage.getItem('device_hash')
      if (stored) return stored
      const hash = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
      localStorage.setItem('device_hash', hash)
      return hash
    } catch {
      return `device_${Date.now()}`
    }
  }

  function getDeviceType(): string {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    return isMobile ? 'mobile' : 'desktop'
  }

  return {
    state,
    status,
    isConnected,
    error,
    generateQR,
    refresh,
    reset,
    handleScan,
    handleConfirm,
    checkStatus
  }
}

export const matrixQrLoginService = useQRLogin()
