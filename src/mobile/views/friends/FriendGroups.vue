<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('mobile_friend_groups.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_friend_groups.loading') }}</van-loading>
        </div>

        <div v-else class="flex flex-col p-16px gap-12px">
          <!-- 空态：给出创建引导，而不是白屏 -->
          <van-empty v-if="groups.length === 0" :description="t('mobile_friend_groups.empty')" image="search" />

          <!-- 分组列表：手风琴减少页面跳转（方案 4.1.2） -->
          <van-collapse v-else v-model="expandedGroups">
            <van-collapse-item v-for="group in groups" :key="group.group_id" :name="group.group_id" :title="group.name">
              <template #value>
                <span class="text-12px text-[--tjg-text-tertiary]">
                  {{ t('mobile_friend_groups.member_count', { count: group.member_count ?? 0 }) }}
                </span>
              </template>

              <van-cell-group inset>
                <van-cell
                  v-for="member in membersOf(group.group_id)"
                  :key="member.user_id"
                  :title="member.displayname || member.user_id"
                  :label="member.user_id" />
                <van-cell v-if="membersOf(group.group_id).length === 0" :title="t('mobile_friend_groups.no_member')" />
              </van-cell-group>

              <div class="flex gap-8px mt-12px px-4px">
                <van-button size="small" @click="openRename(group)">
                  {{ t('mobile_friend_groups.rename') }}
                </van-button>
                <van-button size="small" type="danger" plain @click="handleDelete(group.group_id)">
                  {{ t('mobile_friend_groups.delete') }}
                </van-button>
              </div>
            </van-collapse-item>
          </van-collapse>

          <!-- 创建分组 -->
          <van-cell-group inset class="mt-8px">
            <van-field
              v-model="newGroupName"
              :aria-label="t('mobile_friend_groups.new_placeholder')"
              :placeholder="t('mobile_friend_groups.new_placeholder')"
              maxlength="32" />
          </van-cell-group>
          <div class="px-4px">
            <van-button type="primary" block :disabled="!newGroupName.trim()" @click="handleCreate">
              {{ t('mobile_friend_groups.create') }}
            </van-button>
          </div>
        </div>

        <!-- 重命名弹窗 -->
        <van-dialog
          v-model:show="showRenameDialog"
          :title="t('mobile_friend_groups.rename')"
          show-cancel-button
          :confirm-button-text="t('common.confirm')"
          :cancel-button-text="t('common.cancel')"
          @confirm="handleRename">
          <div class="p-16px">
            <van-field
              v-model="renameInput"
              :aria-label="t('mobile_friend_groups.rename_placeholder')"
              :placeholder="t('mobile_friend_groups.rename_placeholder')"
              maxlength="32" />
          </div>
        </van-dialog>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showConfirmDialog, showToast } from 'vant'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import { matrixFriendService } from '@/services/matrix'
import type { FriendGroup } from '@/services/matrix/friends/friendUtils'
import type { Friend } from '@/services/matrix/sdk'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobileFriendGroups')

const { t } = useI18n()

const loading = ref(false)
const groups = ref<FriendGroup[]>([])
const expandedGroups = ref<string[]>([])
/** groupId → 成员列表（懒加载后缓存） */
const membersByGroup = ref<Record<string, Friend[]>>({})

const newGroupName = ref('')
const renameInput = ref('')
const showRenameDialog = ref(false)
const renamingGroup = ref<FriendGroup | null>(null)

/** 已加载过的分组直接返回缓存，避免展开时重复请求 */
function membersOf(groupId: string): Friend[] {
  return membersByGroup.value[groupId] ?? []
}

async function loadGroups(): Promise<void> {
  loading.value = true
  try {
    groups.value = await matrixFriendService.getFriendGroups()
  } catch (error) {
    logger.error('Failed to load friend groups', error)
    showToast({ type: 'fail', message: t('mobile_friend_groups.load_failed') })
  } finally {
    loading.value = false
  }
}

/** 展开分组时懒加载成员 */
async function loadMembers(groupId: string): Promise<void> {
  if (membersByGroup.value[groupId]) return
  try {
    const friends = await matrixFriendService.getFriendsInGroup(groupId)
    membersByGroup.value = { ...membersByGroup.value, [groupId]: friends }
  } catch (error) {
    logger.error(`Failed to load members for group ${groupId}`, error)
  }
}

async function handleCreate(): Promise<void> {
  const name = newGroupName.value.trim()
  if (!name) {
    showToast(t('mobile_friend_groups.name_required'))
    return
  }
  try {
    await matrixFriendService.createFriendGroup(name)
    newGroupName.value = ''
    showToast(t('mobile_friend_groups.create_success'))
    await loadGroups()
  } catch (error) {
    logger.error('Failed to create friend group', error)
    showToast({ type: 'fail', message: t('mobile_friend_groups.create_failed') })
  }
}

function openRename(group: FriendGroup): void {
  renamingGroup.value = group
  renameInput.value = group.name
  showRenameDialog.value = true
}

async function handleRename(): Promise<void> {
  const group = renamingGroup.value
  const name = renameInput.value.trim()
  if (!group) return
  if (!name) {
    showToast(t('mobile_friend_groups.name_required'))
    return
  }
  try {
    await matrixFriendService.renameFriendGroup(group.group_id, name)
    showRenameDialog.value = false
    showToast(t('mobile_friend_groups.rename_success'))
    await loadGroups()
  } catch (error) {
    logger.error('Failed to rename friend group', error)
    showToast({ type: 'fail', message: t('mobile_friend_groups.rename_failed') })
  }
}

async function handleDelete(groupId: string): Promise<void> {
  const group = groups.value.find((g) => g.group_id === groupId)
  try {
    await showConfirmDialog({
      title: t('mobile_friend_groups.delete'),
      message: t('mobile_friend_groups.delete_confirm', {
        name: group?.name ?? t('mobile_friend_groups.unnamed')
      }),
      confirmButtonText: t('mobile_friend_groups.delete'),
      cancelButtonText: t('common.cancel')
    })
  } catch {
    // 用户取消
    return
  }

  try {
    await matrixFriendService.deleteFriendGroup(groupId)
    showToast(t('mobile_friend_groups.delete_success'))
    await loadGroups()
  } catch (error) {
    logger.error('Failed to delete friend group', error)
    showToast({ type: 'fail', message: t('mobile_friend_groups.delete_failed') })
  }
}

onMounted(async () => {
  await loadGroups()
})

// 展开时懒加载成员（折叠不请求）
watch(expandedGroups, (ids) => {
  for (const id of ids) {
    void loadMembers(id)
  }
})
</script>
