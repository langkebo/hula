<template>
  <!-- 公告消息 -->
  <n-flex vertical :size="0" class="h-170px bg-[--hula-surface-muted] rounded-8px custom-shadow" :style="cardStyle">
    <n-flex class="h-34px px-12px select-none cursor-default" align="center" justify="space-between">
      <n-flex align="center" :size="8">
        <svg class="size-16px flex-shrink-0"><use href="#Loudspeaker"></use></svg>
        <p class="text-(12px [--hula-text-tertiary])">{{ t('components.announcementCard.title') }}</p>
      </n-flex>

      <p class="select-none cursor-default flex-shrink-0 text-(12px [--hula-text-tertiary])">
        {{ formatTimestamp(body.updateTime || body.createTime, true) }}
      </p>
    </n-flex>

    <span class="w-full h-1px bg-[--hula-border-default]"></span>

    <p
      :class="showDetailButton ? 'line-clamp-4' : 'line-clamp-5'"
      class="flex-1 px-12px pt-12px cursor-default box-border leading-22px break-words text-(14px [--hula-text-primary])">
      <n-highlight
        v-if="searchKeyword"
        :text="body.content"
        :patterns="[searchKeyword]"
        :highlight-style="{
          userSelect: 'text',
          padding: '2px 4px',
          borderRadius: '6px',
          color: 'var(--hula-text-inverse)',
          background: 'var(--hula-color-primary-500)'
        }" />
      <template v-else>{{ body.content }}</template>
    </p>

    <div v-if="showDetailButton" class="w-full flex-center py-6px cursor-default">
      <n-button
        secondary
        type="primary"
        class="flex-y-center px-12px h-26px text-12px"
        @click.stop="openAnnouncementDetail">
        {{ t('components.announcementCard.viewDetail') }}
      </n-button>
    </div>

    <div v-else class="w-full h-16px"></div>
  </n-flex>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { MittEnum } from '@/enums'
import { useMitt } from '@/hooks/useMitt'
import type { AnnouncementBody } from '@/services/types'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { formatTimestamp } from '@/utils/ComputedTime.ts'
import { isMobile } from '@/utils/PlatformConstants'

const props = defineProps<{
  body: AnnouncementBody
  searchKeyword?: string
}>()

const { t } = useI18n()
const globalStore = useGlobalStore()
const route = useRoute()
const router = useRouter()

const showDetailButton = computed(() => {
  const routeName = route.name?.toString()
  return routeName !== 'chat-history' && routeName !== 'multiMsg'
})

const cardStyle = computed(() => (isMobile() ? { width: '60vw' } : { width: '240px' }))

const openAnnouncementDetail = async () => {
  const roomId = globalStore.currentSessionRoomId
  if (!roomId) {
    return
  }

  if (isMobile()) {
    router.push(`/mobile/chatRoom/notice/detail/${props.body.id}`)
  } else {
    useMitt.emit(MittEnum.OPEN_ANNOUNCEMENT_PANEL, { roomId })
  }
}
</script>
