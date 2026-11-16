<template>
  <n-drawer :show="show" placement="right" :width="560" @update:show="emit('update:show', $event)">
    <n-drawer-content :title="t('admin.users.batchCreateTitle')" closable>
      <n-space vertical :size="12">
        <n-alert type="info" :bordered="false">{{ t('admin.users.batchCreateHint') }}</n-alert>
        <n-input
          v-model:value="input"
          type="textarea"
          :rows="8"
          :placeholder="t('admin.users.batchCreatePlaceholder')"
          :disabled="batchCreating" />
        <div class="batch-create-meta">
          {{ t('admin.users.batchCreateParsed', { count: parsedEntries.length }) }}
        </div>
        <n-alert v-if="parseError" type="error" :bordered="false">{{ parseError }}</n-alert>

        <n-space justify="end">
          <n-button @click="emit('update:show', false)">{{ t('admin.common.cancel') }}</n-button>
          <n-button
            type="primary"
            :loading="batchCreating"
            :disabled="parsedEntries.length === 0 || Boolean(parseError)"
            @click="handleSubmit">
            {{ t('admin.users.batchCreateSubmit') }}
          </n-button>
        </n-space>

        <n-data-table
          v-if="results.length > 0"
          :columns="resultColumns"
          :data="results"
          :bordered="false"
          size="small"
          :row-key="(row: BatchCreateResult) => row.userId" />
      </n-space>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { NAlert, NButton, NDataTable, NDrawer, NDrawerContent, NInput, NSpace, NTag } from 'naive-ui'
import { computed, h, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BatchCreateUserInput, UseAdminUsersResult } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useAdminErrorHandler } from './useAdminError'

interface BatchCreateResult {
  userId: string
  success: boolean
}

const props = defineProps<{
  /** 父级持有的用户管理 composable 实例；本组件不自行创建，避免状态分叉。 */
  admin: UseAdminUsersResult
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { handleAdminError } = useAdminErrorHandler()
const { batchCreating } = props.admin

const input = ref('')
const results = ref<BatchCreateResult[]>([])
const parseError = ref('')

const parsedEntries = computed<BatchCreateUserInput[]>(() => {
  const lines = input.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.map((line) => {
    const [username, password, displayname, adminFlag] = line.split(',').map((part) => part.trim())
    const entry: BatchCreateUserInput = {
      username: username ?? '',
      password: password ?? '',
      admin: adminFlag === 'admin' || adminFlag === 'true'
    }
    if (displayname) entry.displayname = displayname
    return entry
  })
})

const resultColumns = computed(() => [
  { title: t('admin.users.batchResultUser'), key: 'userId', ellipsis: { tooltip: true } },
  {
    title: t('admin.users.batchResultStatus'),
    key: 'success',
    width: 110,
    render(row: BatchCreateResult) {
      return h(NTag, { type: row.success ? 'success' : 'error', size: 'small' }, () =>
        row.success ? t('admin.users.batchResultSuccess') : t('admin.users.batchResultFailed')
      )
    }
  }
])

async function handleSubmit() {
  parseError.value = ''
  const invalid = parsedEntries.value.find((entry) => !entry.username || !entry.password)
  if (invalid) {
    parseError.value = t('admin.users.batchCreateInvalid')
    return
  }
  try {
    const result = await props.admin.batchCreateUsers(parsedEntries.value)
    results.value = result
    const failedCount = result.filter((item) => !item.success).length
    if (failedCount === 0) {
      showFeedback(t('admin.users.batchCreateSuccess', { count: result.length }), 'success')
    } else {
      showFeedback(t('admin.users.batchCreatePartial', { failed: failedCount }), 'warning')
    }
  } catch (err) {
    if (handleAdminError(err)) showFeedback(t('admin.users.batchCreateFailed'), 'error')
  }
}
</script>

<style scoped lang="scss">
.batch-create-meta {
  font-size: 12px;
  color: var(--tjg-text-secondary);
}
</style>
