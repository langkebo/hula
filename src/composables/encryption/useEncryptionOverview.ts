import { toRef } from 'vue'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'

/**
 * 加密总览：加密开关、当前设备验证、备份、交叉签名与轮换状态的唯一读取/刷新入口。
 *
 * 桌面与移动加密设置页共用，避免移动端再直接调用 crypto 服务自行拼装同一份状态；
 * 数据与副作用收在这一层，模板保留各自的平台差异。
 */
export function useEncryptionOverview() {
  const store = useEncryptionStore()

  const encryptionEnabled = toRef(store, 'encryptionEnabled')
  const deviceVerified = toRef(store, 'deviceVerified')
  const backupEnabled = toRef(store, 'backupEnabled')
  const backupVersion = toRef(store, 'backupVersion')
  const crossSigningSetup = toRef(store, 'crossSigningSetup')
  const needsRotation = toRef(store, 'needsRotation')
  const e2eeFullySetup = toRef(store, 'e2eeFullySetup')
  const loading = toRef(store, 'loading')

  /**
   * 刷新总览：先读加密开关，启用后再读当前设备验证状态。
   * @returns 加密是否启用（未启用时后续状态无需读取）
   */
  async function loadOverview(): Promise<boolean> {
    await store.loadEncryptionStatus()
    if (!store.encryptionEnabled) return false
    await store.loadDeviceVerification()
    return true
  }

  /** 刷新备份状态（新建/恢复/完成备份流程后调用） */
  async function refreshBackup(): Promise<void> {
    await store.loadBackupStatus()
  }

  /** 刷新当前设备验证状态（完成验证后调用） */
  async function refreshDeviceVerification(): Promise<void> {
    await store.loadDeviceVerification()
  }

  return {
    encryptionEnabled,
    deviceVerified,
    backupEnabled,
    backupVersion,
    crossSigningSetup,
    needsRotation,
    e2eeFullySetup,
    loading,
    loadOverview,
    refreshBackup,
    refreshDeviceVerification
  }
}
