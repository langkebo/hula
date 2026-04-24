<template>
  <div class="friend-group-view">
    <n-flex vertical :size="12" class="p-12px">
      <n-flex align="center" justify="space-between">
        <span class="text-16px font-semibold">{{ t('friend.group.title') }}</span>
        <n-button quaternary circle size="small" @click="showCreateDialog = true">
          <template #icon>
            <n-icon><svg><use href="#plus" /></svg></n-icon>
          </template>
        </n-button>
      </n-flex>

      <n-input v-model:value="searchValue" :placeholder="t('friend.group.search')" size="small" clearable>
        <template #prefix>
          <n-icon size="16"><svg><use href="#search" /></svg></n-icon>
        </template>
      </n-input>
    </n-flex>

    <n-divider style="margin: 0" />

    <n-spin :show="loading">
      <n-scrollbar style="height: calc(100vh - 200px)">
        <n-empty v-if="filteredGroups.length === 0" :description="t('friend.group.empty')" class="mt-40px" />
        <div v-else class="group-items">
          <div
            v-for="group in filteredGroups"
            :key="group.group_id"
            class="group-item"
            @click="handleSelectGroup(group)"
            @contextmenu="handleContextMenu($event, group)">
            <n-flex align="center" :size="12">
              <div class="w-44px h-44px rounded-8px bg-[--bg-color] flex items-center justify-center">
                <svg class="size-24px text-[--text-color]"><use href="#folder" /></svg>
              </div>
              <n-flex vertical :size="4" class="flex-1 truncate">
                <span class="text-14px truncate">{{ group.name }}</span>
                <span class="text-(12px --color-text-tertiary)">{{ t('friend.group.member_count', { count: group.member_count ?? 0 }) }}</span>
              </n-flex>
            </n-flex>
          </div>
        </div>
      </n-scrollbar>
    </n-spin>

    <n-modal v-model:show="showCreateDialog" :title="t('friend.group.create')" preset="dialog">
      <n-input v-model:value="newGroupName" :placeholder="t('friend.group.name_placeholder')" />
      <template #action>
        <n-flex justify="end" :size="12">
          <n-button @click="showCreateDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="creating" :disabled="!newGroupName.trim()" @click="handleCreateGroup">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>

    <n-modal v-model:show="showRenameDialog" :title="t('friend.group.rename')" preset="dialog">
      <n-input v-model:value="renameValue" :placeholder="t('friend.group.name_placeholder')" />
      <template #action>
        <n-flex justify="end" :size="12">
          <n-button @click="showRenameDialog = false">{{ t('common.cancel') }}</n-button>
          <n-button type="primary" :loading="renaming" :disabled="!renameValue.trim()" @click="handleRenameGroup">
            {{ t('common.confirm') }}
          </n-button>
        </n-flex>
      </template>
    </n-modal>

    <n-dropdown
      :x="contextMenuX"
      :y="contextMenuY"
      :show="showContextMenu"
      :options="contextMenuOptions"
      placement="bottom-start"
      @select="handleContextAction"
      @clickoutside="showContextMenu = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMessage, NIcon } from 'naive-ui'
import { matrixFriendService } from '@/services/matrix'
import type { FriendGroup } from '@/services/matrix/friends/MatrixFriendService'

const { t } = useI18n()
const message = useMessage()

const loading = ref(false)
const groups = ref<FriendGroup[]>([])
const searchValue = ref('')
const showCreateDialog = ref(false)
const newGroupName = ref('')
const creating = ref(false)
const showRenameDialog = ref(false)
const renameValue = ref('')
const renaming = ref(false)
const selectedGroup = ref<FriendGroup | null>(null)
const showContextMenu = ref(false)
const contextMenuX = ref(0)
const contextMenuY = ref(0)

const filteredGroups = computed(() => {
  if (!searchValue.value) return groups.value
  return groups.value.filter((g) => g.name.toLowerCase().includes(searchValue.value.toLowerCase()))
})

const contextMenuOptions = computed(() => [
  { label: t('friend.group.rename'), key: 'rename' },
  { label: t('friend.group.delete'), key: 'delete' }
])

async function loadGroups() {
  loading.value = true
  try {
    groups.value = await matrixFriendService.getFriendGroups()
  } catch {
    message.error(t('friend.group.load_failed'))
  } finally {
    loading.value = false
  }
}

async function handleCreateGroup() {
  creating.value = true
  try {
    await matrixFriendService.createFriendGroup(newGroupName.value.trim())
    message.success(t('friend.group.create_success'))
    showCreateDialog.value = false
    newGroupName.value = ''
    await loadGroups()
  } catch {
    message.error(t('friend.group.create_failed'))
  } finally {
    creating.value = false
  }
}

async function handleRenameGroup() {
  if (!selectedGroup.value) return
  renaming.value = true
  try {
    await matrixFriendService.renameFriendGroup(selectedGroup.value.group_id, renameValue.value.trim())
    message.success(t('friend.group.rename_success'))
    showRenameDialog.value = false
    await loadGroups()
  } catch {
    message.error(t('friend.group.rename_failed'))
  } finally {
    renaming.value = false
  }
}

async function handleDeleteGroup(groupId: string) {
  try {
    await matrixFriendService.deleteFriendGroup(groupId)
    message.success(t('friend.group.delete_success'))
    await loadGroups()
  } catch {
    message.error(t('friend.group.delete_failed'))
  }
}

function handleSelectGroup(group: FriendGroup) {
  selectedGroup.value = group
}

function handleContextMenu(e: MouseEvent, group: FriendGroup) {
  e.preventDefault()
  selectedGroup.value = group
  contextMenuX.value = e.clientX
  contextMenuY.value = e.clientY
  showContextMenu.value = true
}

function handleContextAction(key: string) {
  showContextMenu.value = false
  if (!selectedGroup.value) return
  if (key === 'rename') {
    renameValue.value = selectedGroup.value.name
    showRenameDialog.value = true
  } else if (key === 'delete') {
    handleDeleteGroup(selectedGroup.value.group_id)
  }
}

onMounted(() => {
  loadGroups()
})
</script>

<style scoped>
.group-item {
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: background-color 0.2s;
}
.group-item:hover {
  background-color: var(--hover-color);
}
</style>
