<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_security.key_backup')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <van-loading v-if="loading" size="24px" class="loading-container" />

        <div v-else-if="versions.length === 0" class="empty-container">
          <van-empty :description="t('encryption.no_backup')">
            <van-button type="primary" size="small" @click="handleCreate">
              {{ t('encryption.create_backup') }}
            </van-button>
          </van-empty>
        </div>

        <div v-else class="backup-list">
          <van-cell-group inset>
            <van-cell v-for="version in versions" :key="version.version">
              <template #title>
                <div class="backup-info">
                  <span class="backup-version">{{ t('encryption.backup_version') }}: {{ version.version }}</span>
                  <span class="backup-algorithm">{{ t('encryption.algorithm') }}: {{ version.algorithm }}</span>
                  <span v-if="version.count" class="backup-count">{{ t('encryption.key_count') }}: {{ version.count }}</span>
                </div>
              </template>
              <template #right-icon>
                <van-button-group direction="horizontal" class="backup-actions">
                  <van-button size="small" type="primary" plain @click="handleVerify(version.version)">
                    {{ t('encryption.verify') }}
                  </van-button>
                  <van-button size="small" type="primary" plain @click="handleRestore(version.version)">
                    {{ t('encryption.restore') }}
                  </van-button>
                  <van-button size="small" type="danger" plain @click="handleDelete(version)">
                    {{ t('encryption.delete') }}
                  </van-button>
                </van-button-group>
              </template>
            </van-cell>
          </van-cell-group>
        </div>

        <van-button v-if="versions.length > 0" type="primary" size="small" block class="create-btn" @click="handleCreate">
          {{ t('encryption.create_backup') }}
        </van-button>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { showToast, showDialog, showConfirmDialog } from 'vant'
import { useI18n } from 'vue-i18n'
import matrixKeyBackupService, { type BackupVersionInfo } from '@/services/matrix/MatrixKeyBackupService'

const { t } = useI18n()

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
    showToast(t('encryption.backup_created'))
    loadVersions()
  } catch {
    showToast(t('encryption.backup_create_failed'))
  }
}

async function handleVerify(version: string) {
  try {
    const result = await matrixKeyBackupService.verifyBackup(version)
    if (result.valid) {
      showToast(t('encryption.backup_valid'))
    } else {
      showToast(t('encryption.backup_invalid'))
    }
  } catch {
    showToast(t('encryption.verify_failed'))
  }
}

function handleRestore(version: string) {
  showDialog({
    title: t('encryption.restore_keys'),
    message: t('encryption.enter_recovery_key'),
    showCancelButton: true,
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel'),
    onConfirm: async () => {
      try {
        await matrixKeyBackupService.recoverKeys('', version)
        showToast(t('encryption.keys_restored'))
      } catch {
        showToast(t('encryption.restore_failed'))
      }
    }
  })
}

function handleDelete(version: BackupVersionInfo) {
  showConfirmDialog({
    title: t('encryption.delete_backup'),
    message: t('encryption.delete_backup_confirm'),
    confirmButtonText: t('common.confirm'),
    cancelButtonText: t('common.cancel')
  }).then(async () => {
    try {
      await matrixKeyBackupService.deleteBackupVersion(version.version)
      showToast(t('encryption.backup_deleted'))
      loadVersions()
    } catch {
      showToast(t('encryption.delete_failed'))
    }
  }).catch(() => {})
}

onMounted(() => {
  loadVersions()
})
</script>

<style scoped lang="scss">
.loading-container {
  display: flex;
  justify-content: center;
  padding: 48px 0;
}

.empty-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0;
}

.backup-list {
  padding: 12px 0;
}

.backup-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.backup-version {
  font-size: 14px;
  font-weight: 500;
}

.backup-algorithm,
.backup-count {
  font-size: 12px;
  color: #909090;
}

.backup-actions {
  margin-top: 8px;
}

.create-btn {
  margin: 16px;
}
</style>
