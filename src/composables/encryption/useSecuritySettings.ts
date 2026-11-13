import { computed } from 'vue'
import { useEncryptionStore } from '@/stores/domains/settings/encryption'
import { useKeyExport } from './useKeyExport'

/** 备份摘要：version 为空表示服务端未返回版本号 */
export interface SecurityBackupInfo {
  version: string | null
  count: number
}

/** 恢复密钥导出结果：失败原因由调用方翻译成本端文案 */
export type RecoveryKeyExportResult = { ok: true } | { ok: false; reason: 'encryption-disabled' | 'empty' }

/**
 * 安全设置的共享状态与动作（桌面 Settings → 安全 / 移动 我的 → 安全）。
 *
 * 两端此前各自从 `encryptionStore` 推导「加密开关 / 交叉签名 / 备份状态」，
 * 并各自实现恢复密钥导出的前置判断 —— 判定口径一旦分叉，同一账号在两端
 * 会显示不同的安全状态。这里只收敛**判定与数据**，提示文案与控件仍由各端负责。
 */
export function useSecuritySettings() {
  const encryptionStore = useEncryptionStore()
  const { isExporting, exportKeys } = useKeyExport()

  const encryptionEnabled = computed(() => encryptionStore.encryptionEnabled)
  const securityKeyConfigured = computed(() => encryptionStore.securityKeyConfigured)
  const hasBackup = computed(() => encryptionStore.backupEnabled)
  const backupInfo = computed<SecurityBackupInfo | null>(() =>
    encryptionStore.backupEnabled
      ? { version: encryptionStore.backupVersion || null, count: encryptionStore.backupKeyCount }
      : null
  )
  const backupLoading = computed(() => encryptionStore.loading)

  /** 拉取加密 + 备份聚合状态（内部 allSettled，单项失败不影响其余项） */
  async function refreshEncryptionStatus(): Promise<void> {
    await encryptionStore.loadEncryptionStatus()
  }

  /** 备份创建/恢复完成后只刷新备份分支，避免整页状态重载 */
  async function refreshBackupStatus(): Promise<void> {
    await encryptionStore.loadBackupStatus()
  }

  /** 安全密钥创建成功的本地标记（服务端状态由下次 refresh 校准） */
  function markSecurityKeyConfigured(): void {
    encryptionStore.markSecurityKeyConfigured()
  }

  /**
   * 导出房间恢复密钥。
   *
   * 未开启加密时直接返回 `encryption-disabled`，而不是让 SDK 导出空内容 ——
   * 否则两端只能显示「导出失败/为空」，用户看不出根因。
   * SDK 异常仍向上抛出，由调用方决定日志与提示。
   */
  async function exportRecoveryKeys(fileName: string): Promise<RecoveryKeyExportResult> {
    if (!encryptionEnabled.value) return { ok: false, reason: 'encryption-disabled' }
    const data = await exportKeys(fileName)
    return data ? { ok: true } : { ok: false, reason: 'empty' }
  }

  return {
    encryptionEnabled,
    securityKeyConfigured,
    hasBackup,
    backupInfo,
    backupLoading,
    exportLoading: isExporting,
    refreshEncryptionStatus,
    refreshBackupStatus,
    markSecurityKeyConfigured,
    exportRecoveryKeys
  }
}
