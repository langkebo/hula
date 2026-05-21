<template>
  <n-modal
    v-model:show="visible"
    class="h-fit w-320px"
    preset="card"
    :title="t('home.profile_card.online_status')"
    :bordered="false"
    :closable="true">
    <n-flex
      vertical
      :size="20"
      :style="`background: linear-gradient(to bottom, ${statusBgColor} 0%, var(--hula-surface-panel) 100%)`"
      class="p-20px box-border rounded-8px">
      <!-- 当前选中的状态 -->
      <n-flex justify="center" align="center" class="py-10px">
        <img class="w-34px h-34px" :src="statusIcon" :alt="displayStatusTitle" />
        <span class="text-22px ml-8px">{{ displayStatusTitle }}</span>
      </n-flex>

      <!-- 状态列表 -->
      <n-scrollbar style="max-height: 250px">
        <n-flex align="center" :size="10">
          <n-flex @click="handleResetState" vertical justify="center" align="center" :size="8" class="status-item">
            <svg class="size-24px color-[--hula-color-danger-500]">
              <use href="#forbid"></use>
            </svg>
            <span class="text-11px">{{ t('auth.onlineStatus.reset_title') }}</span>
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
  </n-modal>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import type { UserState } from '@/services/types'
import { useUserStatusStore } from '@/stores/domains/user/userStatus'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const userStatusStore = useUserStatusStore()
const { stateList } = storeToRefs(userStatusStore)
const { currentState, statusIcon, statusTitle, statusBgColor, hasCustomState } = useOnlineStatus()

const visible = computed({
  get: () => props.show,
  set: (val) => emit('update:show', val)
})

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

const handleActive = async (item: UserState) => {
  try {
    await userStatusStore.changeCurrentUserState(item)
    showFeedback(t('auth.onlineStatus.messages.success'), 'success')
    visible.value = false
  } catch (error) {
    showFeedback(t('auth.onlineStatus.messages.error'), 'error')
  }
}
</script>

<style scoped lang="scss">
.status-item {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--hula-surface-list-hover);
  }

  &.active {
    background: var(--hula-surface-session-active);
    color: var(--hula-text-inverse);
  }
}
</style>
