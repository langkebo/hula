<template>
  <n-modal
    v-model:show="visible"
    preset="card"
    :title="t('message_container.edit_history.title')"
    :bordered="false"
    class="edit-history-dialog w-[var(--tjg-dialog-width-md)] max-w-[92vw]">
    <div v-if="loading" class="edit-history-state">{{ t('message_container.edit_history.loading') }}</div>
    <EmptyState v-else-if="isEmptyVersions" compact :description="t('message_container.edit_history.empty')" />
    <ol v-else class="edit-history-list">
      <li v-for="(item, index) in versions" :key="item.eventId" class="edit-history-item">
        <div class="edit-history-item__head">
          <span class="edit-history-item__version">
            {{ t('message_container.edit_history.version', { n: index + 1 }) }}
          </span>
          <span class="edit-history-item__time">{{ formatChatTime(item.timestamp) }}</span>
        </div>
        <div class="edit-history-item__body">{{ item.body }}</div>
      </li>
    </ol>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import EmptyState from '@/components/common/EmptyState.vue'
import { matrixMessageRelationService } from '@/services/matrix/messaging/MatrixMessageRelationService'
import { formatChatTime } from '@/utils/ComputedTime'

interface EditVersion {
  eventId: string
  timestamp: number
  body: string
}

const props = defineProps<{
  show: boolean
  roomId: string
  /** 必须是**服务端事件 ID**（`$xxx`）：本地 ID 在服务端没有 `/relations` 记录 */
  eventId: string
}>()

const emit = defineEmits<{ 'update:show': [value: boolean] }>()

const { t } = useI18n()

const visible = computed({
  get: () => props.show,
  set: (value: boolean) => emit('update:show', value)
})

const loading = ref(false)
const versions = ref<EditVersion[]>([])

const isEmptyVersions = computed(() => versions.value.length === 0)

/**
 * 拉取编辑历史。
 *
 * 走 `refreshEditHistory`（服务端 `/relations/m.replace`，失败或为空时回退本地关系容器）——
 * 只读本地容器会在「设备重启后只同步到最新编辑」时少版本，服务端才是完整事实源。
 */
const loadHistory = async () => {
  if (!props.roomId || !props.eventId) {
    versions.value = []
    return
  }
  loading.value = true
  try {
    const edits = await matrixMessageRelationService.refreshEditHistory(props.roomId, props.eventId)
    versions.value = edits.map((edit) => ({
      eventId: edit.eventId,
      timestamp: edit.timestamp,
      body: String((edit.newContent as Record<string, unknown>)?.body ?? '')
    }))
  } catch {
    // 服务层已做「失败回退本地」，这里只兜住意外异常，界面退化为空态而不是白屏
    versions.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.show,
  (show) => {
    if (show) void loadHistory()
  },
  { immediate: true }
)
</script>

<style scoped lang="scss">
.edit-history-state {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--tjg-text-tertiary);
}

.edit-history-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 52vh;
  overflow-y: auto;
}

.edit-history-item {
  padding: 10px 12px;
  border-radius: var(--tjg-radius-md);
  background: var(--tjg-surface-app);
  border-left: 3px solid var(--tjg-color-primary-500);
}

.edit-history-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.edit-history-item__version {
  font-size: 12px;
  font-weight: 600;
  color: var(--tjg-color-primary-600);
}

.edit-history-item__time {
  font-size: 11px;
  color: var(--tjg-text-tertiary);
}

.edit-history-item__body {
  font-size: 13px;
  line-height: 1.5;
  color: var(--tjg-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
