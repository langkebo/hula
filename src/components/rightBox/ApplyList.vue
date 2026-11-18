<template>
  <n-flex vertical class="select-none">
    <n-flex align="center" justify="space-between" class="color-[--tjg-text-primary] px-20px py-10px">
      <p class="text-[length:var(--tjg-font-size-lg)]">
        {{ t(props.type === 'friend' ? 'home.apply_list.friend_notice' : 'home.apply_list.group_notice') }}
      </p>
    </n-flex>

    <n-virtual-list
      class="max-h-[calc(var(--tjg-viewport-height, 100vh)/var(--page-scale,1)-80px)]"
      :items="applyList"
      :item-size="102"
      :item-resizable="true"
      @scroll="handleScroll"
      ref="virtualListRef">
      <template #default="{ item }">
        <n-flex vertical :size="10" class="p-[10px_30px] box-border">
          <n-flex
            align="center"
            justify="space-between"
            :size="10"
            class="bg-[--tjg-surface-panel] rounded-10px p-20px box-border border-(1px solid [--tjg-border-default])">
            <n-flex align="center" :size="10" class="min-w-0 flex-1">
              <n-avatar
                round
                size="large"
                :src="
                  props.type === 'friend'
                    ? avatarSrc(getUserInfo(item)?.avatar || '')
                    : avatarSrc(groupDetailsMap[item.roomId]?.avatar || '/default-group-avatar.png')
                "
                class="mr-10px" />
              <n-flex vertical :size="12" class="min-w-0 flex-1">
                <n-flex align="center" :size="10" class="min-w-0 flex-1 gap-10px">
                  <p
                    @click="
                      isCurrentUser(item.senderId) ? (currentUserId = item.operateId) : (currentUserId = item.senderId)
                    "
                    class="text-(14px --tjg-color-primary-500) cursor-pointer shrink-0 max-w-150px truncate">
                    {{
                      item.eventType === NoticeType.GROUP_MEMBER_DELETE && item.operateId == item.receiverId
                        ? t('home.apply_list.you')
                        : getUserInfo(item)?.name || t('home.apply_list.unknown_user')
                    }}
                  </p>

                  <div class="flex items-center min-w-0 flex-1 gap-6px">
                    <p class="text-(14px [--tjg-text-primary]) min-w-0 truncate whitespace-nowrap">
                      {{ applyMsg(item) }}
                    </p>

                    <n-button
                      v-if="hasGroupDetailError(item)"
                      text
                      size="tiny"
                      type="primary"
                      class="shrink-0"
                      data-test="apply-group-detail-retry"
                      @click="retryGroupDetail(item.roomId)">
                      {{ t('common.retry') }}
                    </n-button>

                    <p class="text-(12px --tjg-text-tertiary) shrink-0 whitespace-nowrap">
                      {{ formatChatTime(item.createTime) }}
                    </p>
                  </div>
                </n-flex>
                <p
                  :title="t('home.apply_list.message_label') + item.content"
                  v-if="isFriendApplyOrGroupInvite(item)"
                  class="text-(12px [--tjg-text-primary]) cursor-default w-340px truncate">
                  {{ t('home.apply_list.message_label') }}{{ item.content }}
                </p>
                <p v-else class="text-(12px [--tjg-text-primary])">
                  {{
                    t('home.apply_list.handler_label', {
                      name: groupStore.getUserInfo(item.senderId)?.name || t('home.apply_list.unknown_user')
                    })
                  }}
                </p>
              </n-flex>
            </n-flex>

            <div v-if="isFriendApplyOrGroupInvite(item)" class="shrink-0 flex items-center gap-10px">
              <n-flex
                align="center"
                :size="10"
                class="shrink-0"
                v-if="item.status === RequestNoticeAgreeStatus.UNTREATED && !isCurrentUser(item.senderId)">
                <n-button secondary :loading="loadingMap[item.applyId]" @click="handleAgree(item)">
                  {{ t('home.apply_list.accept') }}
                </n-button>
                <n-dropdown
                  trigger="click"
                  :options="dropdownOptions"
                  @select="(key: string) => handleFriendAction(key, item.applyId)">
                  <n-icon class="cursor-pointer px-6px">
                    <svg class="size-16px color-[--tjg-text-primary]" aria-hidden="true">
                      <use href="#more"></use>
                    </svg>
                  </n-icon>
                </n-dropdown>
              </n-flex>
              <span
                class="text-(12px [--tjg-color-primary-500])"
                v-else-if="item.status === RequestNoticeAgreeStatus.ACCEPTED">
                {{ t('home.apply_list.status.accepted') }}
              </span>
              <span
                class="text-(12px [--tjg-color-danger-500])"
                v-else-if="item.status === RequestNoticeAgreeStatus.REJECTED">
                {{ t('home.apply_list.status.rejected') }}
              </span>
              <span class="text-(12px --tjg-text-tertiary)" v-else-if="item.status === RequestNoticeAgreeStatus.IGNORE">
                {{ t('home.apply_list.status.ignored') }}
              </span>
              <span
                class="text-(12px [--tjg-color-primary-500])"
                :class="{ 'text-(12px [--tjg-color-danger-500])': item.status === RequestNoticeAgreeStatus.REJECTED }"
                v-else-if="isCurrentUser(item.senderId)">
                {{
                  isAccepted(item)
                    ? t('home.apply_list.status.accepted')
                    : item.status === RequestNoticeAgreeStatus.REJECTED
                      ? t('home.apply_list.status.rejected_by_other')
                      : t('home.apply_list.status.pending')
                }}
              </span>
            </div>
          </n-flex>
        </n-flex>
      </template>
    </n-virtual-list>

    <!-- 空数据提示：加载失败时换文案 + 出重试，避免把「读取失败」显示成「暂无好友申请」 -->
    <EmptyState v-if="applyList.length === 0" :description="emptyDescription">
      <template #actions>
        <n-button v-if="showLoadError" size="small" tertiary type="primary" @click="handleRetryLoad">
          {{ t('common.retry') }}
        </n-button>
      </template>
    </EmptyState>
  </n-flex>
</template>
<script setup lang="ts">
import { useApplyList } from './useApplyList'

const props = defineProps<{
  type: 'friend' | 'group'
}>()

const {
  t,
  groupStore,
  isAccepted,
  currentUserId,
  loadingMap,
  applyList,
  groupDetailsMap,
  showLoadError,
  emptyDescription,
  handleRetryLoad,
  hasGroupDetailError,
  retryGroupDetail,
  applyMsg,
  dropdownOptions,
  avatarSrc,
  isCurrentUser,
  getUserInfo,
  isFriendApplyOrGroupInvite,
  handleScroll,
  handleAgree,
  handleFriendAction,
  formatChatTime,
  NoticeType,
  RequestNoticeAgreeStatus
} = useApplyList({ props })
</script>

<style scoped lang="scss"></style>
