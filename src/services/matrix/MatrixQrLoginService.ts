/**
 * Matrix QR 登录服务
 *
 * 使用 SDK QrLoginManager 实现 QR 码登录功能
 * 参考: MSC4388 - QR Code Login
 */

import { ref, computed } from 'vue'
import matrixClientService from './MatrixClientService'
import { info, error as logError, warn } from '@tauri-apps/plugin-log'

export type QRLoginStatus =
  | 'idle'
  | 'generating'
  | 'waiting_scan'
  | 'waiting_confirm'
  | 'success'
  | 'expired'
  | 'failed'

export interface QRLoginState {
  status: QRLoginStatus
  transactionId?: string
  qrCodeData?: string
  error?: string
  userId?: string
  accessToken?: string
  deviceId?: string
}

export interface QRLoginResult {
  transactionId?: string
  qrCodeData?: string
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
  timeout?: number
}

export function useQRLogin(options: UseQRLoginOptions = {}) {
  const pollInterval = options.pollInterval || 2000
  const _timeout = options.timeout || 300000

  const state = ref<QRLoginState>({
    status: 'idle'
  })

  let pollTimer: number | null = null

  const status = computed(() => state.value.status)
  const isConnected = computed(() => state.value.status === 'success')
  const error = computed(() => state.value.error)

  async function generateQR(): Promise<QRLoginResult | null> {
    try {
      state.value.status = 'generating'
      state.value.error = undefined

      const client = matrixClientService.getClient()
      if (!client) {
        throw new Error('客户端未初始化')
      }

      info('[QRLogin] 尝试使用 SDK QrLoginManager 生成 QR 码')

      const qrLoginManager = client.getQrLoginManager()
      const qrResponse = await qrLoginManager.getQrCode()

      state.value.transactionId = qrResponse.transaction_id
      state.value.qrCodeData = JSON.stringify({
        transaction_id: qrResponse.transaction_id,
        mode: qrResponse.mode,
        challenge: qrResponse.challenge
      })
      state.value.status = 'waiting_scan'

      info(`[QRLogin] SDK 生成 QR 码成功: ${qrResponse.transaction_id}`)
      options.onStatusChange?.('waiting_scan')

      startPolling()

      return {
        transactionId: qrResponse.transaction_id,
        qrCodeData: state.value.qrCodeData
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'QR码生成失败'
      state.value.status = 'failed'
      state.value.error = errorMessage
      logError(`[QRLogin] QR码生成失败: ${errorMessage}`)
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
    if (!state.value.transactionId) return

    try {
      const client = matrixClientService.getClient()
      if (!client) return

      const qrLoginManager = client.getQrLoginManager()
      const statusResponse = await qrLoginManager.getQrStatus(state.value.transactionId)

      if (statusResponse.status === 'confirmed') {
        stopPolling()
        state.value.status = 'success'
        state.value.userId = statusResponse.user_id

        info(`[QRLogin] QR 登录成功: ${statusResponse.user_id}`)
        options.onStatusChange?.('success')
        options.onSuccess?.({
          transactionId: state.value.transactionId,
          userId: statusResponse.user_id
        })
      } else if (statusResponse.status === 'expired' || statusResponse.status === 'invalidated') {
        handleExpired()
      }
    } catch (err) {
      warn(`[QRLogin] 检查状态失败: ${err}`)
    }
  }

  async function handleScan(transactionId?: string): Promise<boolean> {
    const finalTransactionId = transactionId || state.value.transactionId
    if (!finalTransactionId) return false

    try {
      const client = matrixClientService.getClient()
      if (!client) return false

      info(`[QRLogin] 尝试使用 SDK 扫码: ${finalTransactionId}`)

      const qrLoginManager = client.getQrLoginManager()
      await qrLoginManager.startQrLogin({
        transaction_id: finalTransactionId,
        initial_display_name: 'HuLa Client'
      })

      state.value.status = 'waiting_confirm'
      options.onStatusChange?.('waiting_confirm')

      info('[QRLogin] SDK 扫码成功')
      return true
    } catch (err) {
      logError(`[QRLogin] 扫码失败: ${err}`)
      return false
    }
  }

  async function handleConfirm(): Promise<boolean> {
    if (!state.value.transactionId) return false

    try {
      const client = matrixClientService.getClient()
      if (!client) return false

      info(`[QRLogin] 尝试使用 SDK 确认登录: ${state.value.transactionId}`)

      const qrLoginManager = client.getQrLoginManager()
      const result = await qrLoginManager.confirmQrLogin({
        transaction_id: state.value.transactionId
      })

      if (result.status === 'confirmed') {
        stopPolling()
        state.value.status = 'success'
        options.onStatusChange?.('success')
        options.onSuccess?.({
          transactionId: state.value.transactionId
        })

        info('[QRLogin] SDK 确认登录成功')
        return true
      }

      return false
    } catch (err) {
      logError(`[QRLogin] 确认登录失败: ${err}`)
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
