<template>
  <div class="section-toolbar">
    <n-button type="primary" @click="showBlockIpDialog = true">
      <template #icon>
        <n-icon><Icon icon="mdi:ip-network" /></n-icon>
      </template>
      {{ t('admin.security.block_ip') }}
    </n-button>
  </div>

  <n-spin :show="loading">
    <div v-if="blocks.length === 0" class="empty-state">
      <n-empty :description="t('admin.security.no_ip_blocks')" />
    </div>
    <n-data-table
      v-else
      :columns="columns"
      :data="blocks"
      :row-key="(row: Record<string, unknown>) => String(row.ip ?? row.id)"
      striped />
  </n-spin>

  <n-drawer v-model:show="showBlockIpDialog" placement="right" :width="380">
    <n-drawer-content :title="t('admin.security.block_ip')" closable>
      <n-form ref="blockIpFormRef" :model="blockIpForm" :rules="blockIpRules">
        <n-form-item :label="t('admin.security.ip_placeholder')" path="ip">
          <n-input v-model:value="blockIpForm.ip" :placeholder="t('admin.security.ip_placeholder')" />
        </n-form-item>
        <n-form-item :label="t('admin.security.col_reason')" path="reason">
          <n-input
            v-model:value="blockIpForm.reason"
            type="textarea"
            :placeholder="t('admin.security.reason_placeholder')"
            :rows="3" />
        </n-form-item>
      </n-form>
      <template #footer>
        <div class="dialog-footer">
          <n-button @click="showBlockIpDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="blockIpLoading" @click="handleBlockIp">
            {{ t('admin.security.block_ip') }}
          </n-button>
        </div>
      </template>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import {
  type DataTableColumns,
  type FormInst,
  NButton,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NPopconfirm,
  NSpin
} from 'naive-ui'
import { h, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { adminService } from '@/services/matrix/admin'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('AdminSecurityIpBlocks')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const blocks = ref<Array<Record<string, unknown>>>([])
const loading = ref(false)
const showBlockIpDialog = ref(false)
const blockIpLoading = ref(false)
const blockIpFormRef = ref<FormInst | null>(null)
const blockIpForm = reactive({ ip: '', reason: '' })
const blockIpRules = {
  ip: { required: true, message: t('admin.security.ip_required'), trigger: 'blur' }
}

const columns: DataTableColumns<Record<string, unknown>> = [
  {
    title: t('admin.security.col_ip'),
    key: 'ip',
    width: 180,
    render: (row) => String(row.ip ?? '')
  },
  {
    title: t('admin.security.col_reason'),
    key: 'reason',
    render: (row) => String(row.reason ?? '-')
  },
  {
    title: t('admin.security.col_blocked_at'),
    key: 'blocked_at',
    width: 180,
    render: (row) => {
      const ts = row.blocked_at ?? row.created_ts ?? row.created_at
      return ts ? new Date(Number(ts)).toLocaleString() : '-'
    }
  },
  {
    title: t('admin.security.col_blocked_by'),
    key: 'blocked_by',
    width: 200,
    render: (row) => String(row.blocked_by ?? row.created_by ?? '-')
  },
  {
    title: t('admin.security.col_actions'),
    key: 'actions',
    width: 100,
    render: (row) =>
      h(
        NPopconfirm,
        { onPositiveClick: () => handleUnblockIp(String(row.ip ?? '')) },
        {
          trigger: () => h(NButton, { type: 'error', size: 'small' }, { default: () => t('admin.security.unblock') }),
          default: () => t('admin.security.unblock_confirm')
        }
      )
  }
]

async function load() {
  loading.value = true
  try {
    const result = await adminService.getIpBlocks()
    blocks.value = result ?? []
  } catch (e) {
    logger.error('Failed to load IP block list', e)
    blocks.value = []
  } finally {
    loading.value = false
  }
}

async function handleBlockIp() {
  try {
    await blockIpFormRef.value?.validate()
  } catch {
    return
  }
  blockIpLoading.value = true
  try {
    const result = await adminService.blockIp(blockIpForm.ip, {
      ...(blockIpForm.reason ? { reason: blockIpForm.reason } : {})
    })
    if (result) {
      showFeedback(t('admin.security.ip_blocked'), 'success')
      showBlockIpDialog.value = false
      blockIpForm.ip = ''
      blockIpForm.reason = ''
      await load()
    } else {
      showFeedback(t('admin.security.block_failed'), 'error')
    }
  } catch (e) {
    logger.error('Failed to block IP', e)
    showFeedback(t('admin.security.block_failed'), 'error')
  } finally {
    blockIpLoading.value = false
  }
}

async function handleUnblockIp(ip: string) {
  try {
    await adminService.unblockIp(ip)
    showFeedback(t('admin.security.ip_unblocked'), 'success')
    await load()
  } catch (e) {
    logger.error('Failed to unblock IP', e)
    showFeedback(t('admin.security.unblock_failed'), 'error')
  }
}

defineExpose({ refresh: load })
</script>

<style scoped>
.section-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.empty-state {
  padding: 60px 0;
  text-align: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
