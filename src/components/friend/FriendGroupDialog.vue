<template>
  <n-modal
    :show="visible"
    preset="card"
    :title="t('friend.group.title')"
    :style="{ width: '420px' }"
    :bordered="false"
    @update:show="$emit('update:visible', $event)">
    <div class="friend-group-dialog">
      <div class="create-row">
        <n-input
          v-model:value="newGroupName"
          :placeholder="t('friend.group.name_placeholder')"
          :disabled="flow.creating.value"
          @keydown.enter="handleCreate" />
        <n-button type="primary" :loading="flow.creating.value" @click="handleCreate">
          {{ t('friend.group.create') }}
        </n-button>
      </div>

      <n-spin :show="flow.loading.value">
        <div class="group-list" v-if="flow.groups.value.length > 0">
          <div v-for="g in flow.groups.value" :key="g.group_id" class="group-item">
            <div class="group-info">
              <template v-if="editingId === g.group_id">
                <n-input
                  v-model:value="editingName"
                  size="small"
                  :loading="flow.renaming.value[g.group_id]"
                  @keydown.enter="handleRename(g.group_id)"
                  @blur="handleRename(g.group_id)" />
              </template>
              <template v-else>
                <span class="group-name">{{ g.name }}</span>
                <span class="group-count">
                  {{ t('friend.group.member_count', { count: g.member_count ?? 0 }) }}
                </span>
              </template>
            </div>
            <div class="group-actions">
              <n-button text size="tiny" @click="startEdit(g)">
                {{ t('friend.group.rename') }}
              </n-button>
              <n-button
                text
                size="tiny"
                type="error"
                :loading="flow.deleting.value[g.group_id]"
                @click="handleDelete(g.group_id)">
                {{ t('friend.group.delete') }}
              </n-button>
            </div>
          </div>
        </div>
        <n-empty v-else :description="t('friend.group.empty')" />
      </n-spin>

      <div v-if="flow.errorMessage.value" class="error-text">
        {{ flow.errorMessage.value }}
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <n-button @click="$emit('update:visible', false)">{{ t('common.close') }}</n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useFriendGroupManagement } from '@/composables/friend/useFriendGroupManagement'
import type { FriendGroup } from '@/services/matrix/friends/MatrixFriendService'

const props = defineProps<{
  visible: boolean
}>()

defineEmits<(e: 'update:visible', value: boolean) => void>()

const { t } = useI18n()

const flow = useFriendGroupManagement()

const newGroupName = ref('')
const editingId = ref<string | null>(null)
const editingName = ref('')

const handleCreate = async () => {
  const result = await flow.createGroup(newGroupName.value)
  if (result) newGroupName.value = ''
}

const startEdit = (g: FriendGroup) => {
  editingId.value = g.group_id
  editingName.value = g.name
}

const handleRename = async (groupId: string) => {
  if (!editingName.value.trim()) {
    editingId.value = null
    return
  }
  const ok = await flow.renameGroup(groupId, editingName.value)
  if (ok) editingId.value = null
}

const handleDelete = async (groupId: string) => {
  await flow.deleteGroup(groupId)
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) flow.load()
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.friend-group-dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.create-row {
  display: flex;
  gap: 8px;
}

.group-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 320px;
  overflow-y: auto;
}

.group-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 6px;
  border-radius: 6px;

  &:hover {
    background: var(--hula-surface-list-hover);
  }
}

.group-info {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-name {
  font-size: 13px;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  font-size: 11px;
  color: var(--hula-text-tertiary);
}

.group-actions {
  display: flex;
  gap: 8px;
}

.error-text {
  font-size: 12px;
  color: var(--hula-color-danger-500, #f56c6c);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}
</style>
