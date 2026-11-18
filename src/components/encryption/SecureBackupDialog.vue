<template>
  <n-modal v-model:show="visible" preset="card" :title="dialogTitle" class="w-[560px]" :mask-closable="false">
    <n-spin :show="loading">
      <SecureBackupStatusTab
        v-if="activeTab === 'status'"
        :status-loading="statusLoading"
        :status-load-failed="statusLoadFailed"
        :backup-exists="backupExists"
        :backup-data="backupData"
        :verify-result="verifyResult"
        @retry="loadBackupStatus"
        @create="activeTab = 'create'"
        @restore="activeTab = 'restore'"
        @verify="handleVerify"
        @add-keys="handleAddKeys"
        @delete="handleDelete"
        @clear-verify="verifyResult = null" />

      <SecureBackupCreateTab
        v-else-if="activeTab === 'create'"
        v-model:create-step="createStep"
        v-model:key-saved="keySaved"
        v-model:current-password="currentPassword"
        :recovery-key="recoveryKey"
        @create="handleCreateBackup"
        @done="handleCreateDone"
        @back-to-status="handleBackToStatus"
        @copy-key="copyKey"
        @download-key="downloadKey" />

      <SecureBackupRestoreTab
        v-else-if="activeTab === 'restore'"
        v-model:restore-recovery-key="restoreRecoveryKey"
        :restore-loading="restoreLoading"
        :restore-result="restoreResult"
        @restore="handleRestore"
        @back-to-status="activeTab = 'status'"
        @clear-result="restoreResult = null" />
    </n-spin>
  </n-modal>
</template>

<script setup lang="ts">
import { NModal, NSpin } from 'naive-ui'
import { computed } from 'vue'
import { useSecureBackupDialog } from '@/composables/encryption/useSecureBackupDialog'
import SecureBackupCreateTab from './SecureBackupCreateTab.vue'
import SecureBackupRestoreTab from './SecureBackupRestoreTab.vue'
import SecureBackupStatusTab from './SecureBackupStatusTab.vue'

defineOptions({
  name: 'SecureBackupDialog'
})

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'success'): void
}>()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

const {
  activeTab,
  loading,
  statusLoading,
  restoreLoading,
  statusLoadFailed,
  backupExists,
  backupData,
  createStep,
  recoveryKey,
  keySaved,
  currentPassword,
  restoreRecoveryKey,
  restoreResult,
  verifyResult,
  dialogTitle,
  loadBackupStatus,
  handleBackToStatus,
  handleCreateBackup,
  handleCreateDone,
  copyKey,
  downloadKey,
  handleRestore,
  handleVerify,
  handleAddKeys,
  handleDelete
} = useSecureBackupDialog({
  isOpen: () => props.show,
  close: () => {
    visible.value = false
  },
  onSuccess: () => emit('success')
})
</script>
