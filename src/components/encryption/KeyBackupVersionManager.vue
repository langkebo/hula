<template>
  <div class="key-backup-manager">
    <n-spin :show="loading">
      <div v-if="versions.length === 0 && !loading" class="text-center py-20px">
        <p class="text-(14px #909090) mb-12px">{{ t('encryption.no_backup', '暂无密钥备份') }}</p>
        <n-button type="primary" @click="handleCreate">{{ t('encryption.create_backup', '创建备份') }}</n-button>
      </div>

      <div v-else>
        <div v-for="version in versions" :key="version.version" class="backup-version-item">
          <n-flex align="center" justify="space-between">
            <n-flex vertical :size="4">
              <span class="text-14px">{{ t('encryption.backup_version', '备份版本') }}: {{ version.version }}</span>
              <span class="text-(12px #909090)">
                {{ t('encryption.algorithm', '算法') }}: {{ version.algorithm }}
              </span>
              <span v-if="version.count" class="text-(12px #909090)">
                {{ t('encryption.key_count', '密钥数量') }}: {{ version.count }}
              </span>
            </n-flex>
            <n-flex :size="8">
              <n-button size="small" secondary @click="handleVerify(version.version)">
                {{ t('encryption.verify', '验证') }}
              </n-button>
              <n-button size="small" secondary @click="handleRestore(version.version)">
                {{ t('encryption.restore', '恢复') }}
              </n-button>
              <n-button size="small" type="error" secondary @click="handleDelete(version)">
                {{ t('encryption.delete', '删除') }}
              </n-button>
            </n-flex>
          </n-flex>
        </div>
      </div>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage, useDialog } from 'naive-ui'
import matrixKeyBackupService, { type BackupVersionInfo } from '@/services/matrix/MatrixKeyBackupService'

const { t } = useI18n()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const versions = ref<BackupVersionInfo[]>([])

async function loadVersions() {
  loading.value = true
  try {
    versions.value = await matrixKeyBackupService.getBackupVersions()
  } catch {
    versions.value = []
  } finally {
    loading.value = false
  }
}

async function handleCreate() {
  try {
    await matrixKeyBackupService.createBackupVersion()
    message.success(t('encryption.backup_created', '备份创建成功'))
    loadVersions()
  } catch (err) {
    message.error(t('encryption.backup_create_failed', '备份创建失败'))
  }
}

async function handleVerify(version: string) {
  try {
    const result = await matrixKeyBackupService.verifyBackup(version)
    if (result.valid) {
      message.success(t('encryption.backup_valid', '备份验证通过'))
    } else {
      message.warning(t('encryption.backup_invalid', '备份验证失败'))
    }
  } catch {
    message.error(t('encryption.verify_failed', '验证失败'))
  }
}

function handleRestore(_version: string) {
  dialog.info({
    title: t('encryption.restore_keys', '恢复密钥'),
    content: t('encryption.enter_recovery_key', '请输入恢复密钥'),
    positiveText: t('common.confirm', '确认'),
    onPositiveClick: async () => {
      try {
        await matrixKeyBackupService.recoverKeys('', _version)
        message.success(t('encryption.keys_restored', '密钥恢复成功'))
      } catch {
        message.error(t('encryption.restore_failed', '恢复失败'))
      }
    }
  })
}

function handleDelete(version: BackupVersionInfo) {
  dialog.warning({
    title: t('encryption.delete_backup', '删除备份'),
    content: t('encryption.delete_backup_confirm', '确定要删除此备份版本吗？此操作不可撤销。'),
    positiveText: t('common.confirm', '确认'),
    negativeText: t('common.cancel', '取消'),
    onPositiveClick: async () => {
      try {
        await matrixKeyBackupService.deleteBackupVersion(version.version)
        message.success(t('encryption.backup_deleted', '备份已删除'))
        loadVersions()
      } catch {
        message.error(t('encryption.delete_failed', '删除失败'))
      }
    }
  })
}

onMounted(() => {
  loadVersions()
})
</script>

<style scoped lang="scss">
.backup-version-item {
  padding: 12px 0;
  border-bottom: 1px solid var(--line-color, #e8e8e8);

  &:last-child {
    border-bottom: none;
  }
}
</style>
