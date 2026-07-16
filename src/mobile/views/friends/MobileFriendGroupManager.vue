<template>
  <van-popup
    :show="visible"
    position="bottom"
    round
    closeable
    :style="{ height: '60%' }"
    @update:show="$emit('update:visible', $event)">
    <div class="friend-group-manager">
      <div class="header">{{ t('friend.group.title') }}</div>

      <div class="create-row">
        <van-field
          v-model="newGroupName"
          :placeholder="t('friend.group.name_placeholder')"
          :disabled="flow.creating.value"
          class="create-input" />
        <van-button
          size="small"
          type="primary"
          :loading="flow.creating.value"
          @click="handleCreate">
          {{ t('friend.group.create') }}
        </van-button>
      </div>

      <van-loading v-if="flow.loading.value" class="loading" />

      <template v-else>
        <div v-if="flow.groups.value.length > 0" class="group-list">
          <van-swipe-cell v-for="g in flow.groups.value" :key="g.group_id">
            <div class="group-item" @click="startEdit(g)">
              <template v-if="editingId === g.group_id">
                <van-field
                  v-model="editingName"
                  :placeholder="t('friend.group.name_placeholder')"
                  class="edit-input"
                  @blur="handleRename(g.group_id)" />
              </template>
              <template v-else>
                <div class="group-info">
                  <div class="group-name">{{ g.name }}</div>
                  <div class="group-count">
                    {{ t('friend.group.member_count', { count: g.member_count ?? 0 }) }}
                  </div>
                </div>
              </template>
            </div>
            <template #right>
              <van-button
                square
                type="danger"
                :loading="flow.deleting.value[g.group_id]"
                :text="t('friend.group.delete')"
                @click="handleDelete(g.group_id)" />
            </template>
          </van-swipe-cell>
        </div>
        <van-empty v-else :description="t('friend.group.empty')" />
      </template>

      <div v-if="flow.errorMessage.value" class="error-text">
        {{ flow.errorMessage.value }}
      </div>
    </div>
  </van-popup>
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
.friend-group-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 0 0;
}

.header {
  padding: 0 16px 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--hula-text-primary);
  border-bottom: 1px solid var(--hula-border-default);
}

.create-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}

.create-input {
  flex: 1;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.group-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 12px;
}

.group-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--hula-border-default);
}

.group-info {
  flex: 1;
  min-width: 0;
}

.group-name {
  font-size: 14px;
  color: var(--hula-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-count {
  font-size: 11px;
  color: var(--hula-text-tertiary);
  margin-top: 2px;
}

.edit-input {
  flex: 1;
}

.error-text {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--hula-color-danger-500, #ee0a24);
}
</style>
