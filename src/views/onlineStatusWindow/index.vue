<template>
  <main class="size-full bg-[--hula-surface-panel] select-none">
    <ActionBar class="absolute right-0 w-full" :shrink="false" :max-w="false" :min-w="false" />

    <n-flex
      vertical
      :size="130"
      :style="`background: linear-gradient(to bottom, ${RGBA} 0%, var(--hula-surface-subtle) 100%)`"
      class="size-full p-20px box-border"
      data-tauri-drag-region>
      <!-- 当前选中的状态 -->
      <n-flex justify="center" align="center" class="pt-80px" data-tauri-drag-region>
        <img class="w-34px h-34px" :src="statusIcon" :alt="displayStatusTitle" />
        <span class="text-22px ml-8px" :title="statusTitle">{{ displayStatusTitle }}</span>
      </n-flex>

      <!-- 状态 -->
      <n-flex
        vertical
        class="w-full h-100vh bg-[--right-bg-color] rounded-6px box-border p-13px"
        data-tauri-drag-region>
        <n-scrollbar style="max-height: 215px">
          <n-flex align="center" :size="10">
            <n-flex @click="handleResetState" vertical justify="center" align="center" :size="8" class="status-item">
              <svg class="size-24px color-[--color-danger]">
                <use href="#forbid"></use>
              </svg>
              <span class="text-11px" :title="t('auth.onlineStatus.reset_title')">
                {{ t('auth.onlineStatus.reset_title') }}
              </span>
            </n-flex>
            <n-flex
              @click="handleActive(item)"
              :class="{ active: hasCustomState && currentState?.id === item.id }"
              v-for="item in stateList"
              :key="item.title"
              vertical
              justify="center"
              align="center"
              :size="8"
              class="status-item">
              <img class="size-24px" :src="item.url" :alt="translateStateTitle(item.title)" />
              <span class="text-11px" :title="translateStateTitle(item.title)">
                {{ translateStateTitle(item.title) }}
              </span>
            </n-flex>
          </n-flex>
        </n-scrollbar>
      </n-flex>
    </n-flex>
  </main>
</template>
<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { formatMatrixError } from '@/common/matrixErrorTranslator'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('OnlineStatusWindow')

import { useOnlineStatus } from '@/composables/common/useOnlineStatus'
import type { UserState } from '@/services/types'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'

const userStatusStore = useUserStatusStore()
const { stateList, stateId } = storeToRefs(userStatusStore)
const { currentState, statusIcon, statusTitle, statusBgColor, hasCustomState } = useOnlineStatus()
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const resetState = computed<UserState>(() => ({
  id: '0',
  title: t('auth.onlineStatus.reset_title'),
  url: ''
}))
const translateStateTitle = (title?: string) => {
  if (!title) return ''
  const key = `auth.onlineStatus.states.${title}`
  const translated = t(key)
  return translated === key ? title : translated
}
const displayStatusTitle = computed(() => translateStateTitle(statusTitle.value))
const handleResetState = () => handleActive(resetState.value)
/** 这里不写入activeItem中是因为v-bind要绑定的值是响应式的 */
const RGBA = ref(statusBgColor.value)

watchEffect(() => {
  RGBA.value = statusBgColor.value
})

/**
 * 处理选中的状态
 * @param { UserState } item 状态
 */
const handleActive = async (item: UserState) => {
  try {
    await userStatusStore.changeCurrentUserState(item)
    showFeedback(t('auth.onlineStatus.messages.success'), 'success')
  } catch (error) {
    logger.error('更新状态失败:', formatMatrixError(error))
    showFeedback(t('auth.onlineStatus.messages.error'), 'error')
  }
}

onMounted(async () => {
  await getCurrentWebviewWindow().show()
  if (!currentState.value) return
  const matched = stateList.value.find((item: { title: string }) => item.title === currentState.value?.title)
  currentState.value.id = matched?.id || '1'
})
</script>
<style scoped lang="scss">
.status-item {
  width: 56px;
  height: 70px;
  border-radius: 8px;
  transition: all 0.4s ease-in-out;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  text-align: center;
  span {
    display: -webkit-box;
    width: 100%;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    white-space: normal;
  }
  &:not(.active):hover {
    background: var(--hula-text-disabled);
    cursor: pointer;
  }
}

.active {
  background: v-bind(RGBA);
  border-radius: 8px;
  cursor: pointer;
  span {
    color: var(--hula-text-inverse);
  }
}

:deep(.action-close) {
  svg {
    color: var(--hula-text-secondary);
  }
}
/** 隐藏naive UI的滚动条 */
:deep(
  .n-scrollbar > .n-scrollbar-rail.n-scrollbar-rail--vertical > .n-scrollbar-rail__scrollbar,
  .n-scrollbar + .n-scrollbar-rail.n-scrollbar-rail--vertical > .n-scrollbar-rail__scrollbar
) {
  display: none;
}
</style>
