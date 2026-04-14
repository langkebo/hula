<template>
  <n-popover
    v-model:show="emojiShow"
    trigger="click"
    :show-arrow="false"
    placement="top-start"
    :disabled="disabled"
    :style="popoverStyle">
    <template #trigger>
      <n-popover
        v-model:show="recentlyTip"
        trigger="hover"
        :delay="800"
        :duration="100"
        :show-arrow="false"
        :disabled="emojiShow || recentEmojis.length < 4"
        placement="top">
        <template #trigger>
          <slot name="trigger">
            <svg class="mr-18px cursor-pointer">
              <use href="#smiling-face"></use>
            </svg>
          </slot>
        </template>
        <div v-if="recentEmojis.length > 0" class="p-4px">
          <div class="text-xs text-gray-500 mb-4px">最近使用</div>
          <div class="flex flex-wrap gap-8px max-w-212px">
            <div
              v-for="(emoji, index) in recentEmojis"
              :key="index"
              class="emoji-item cursor-pointer flex-center hover:bg-gray-100 dark:hover:bg-gray-700 rounded-4px p-2px transition-colors"
              @click="handleRecentEmojiClick(emoji)">
              <img v-if="checkIsUrl(emoji)" :src="resolveRecentRenderUrl(emoji)" class="size-24px" />
              <span v-else class="text-18px">{{ emoji }}</span>
            </div>
          </div>
        </div>
      </n-popover>
    </template>
    <Emoticon @emojiHandle="onEmojiHandle" :all="false" />
  </n-popover>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Emoticon from '@/components/rightBox/emoticon/index.vue'
import { useEmojiStore } from '@/stores/emoji'

export interface EmojiUrlPayload {
  renderUrl: string
  serverUrl: string
}

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    showAll?: boolean
  }>(),
  {
    disabled: false,
    showAll: false
  }
)

const emit = defineEmits<{
  (e: 'emojiSelect', emoji: string): void
  (e: 'emojiUrlSelect', payload: EmojiUrlPayload): void
}>()

const emojiStore = useEmojiStore()
const emojiShow = ref(false)
const recentlyTip = ref(false)

const popoverStyle = {
  padding: '0',
  background: 'var(--bg-emoji)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  boxShadow: '2px 2px 12px 2px var(--box-shadow-color)',
  border: '1px solid var(--box-shadow-color)',
  width: 'auto'
}

const recentEmojis = computed(() => {
  const recent = localStorage.getItem('recentEmojis')
  return recent ? JSON.parse(recent) : []
})

watch(emojiShow, (newValue) => {
  if (newValue === true) {
    recentlyTip.value = false
  }
})

const checkIsUrl = (str: string): boolean => {
  try {
    new URL(str)
    return true
  } catch {
    return false
  }
}

const resolveRecentRenderUrl = (url: string): string => {
  const matched = emojiStore.emojiList.find((item) => item.expressionUrl === url)
  return matched?.localUrl || url
}

const updateRecentEmojis = (emoji: string) => {
  const recent = [...recentEmojis.value]
  const index = recent.indexOf(emoji)
  if (index > -1) {
    recent.splice(index, 1)
  }
  recent.unshift(emoji)
  if (recent.length > 20) {
    recent.pop()
  }
  localStorage.setItem('recentEmojis', JSON.stringify(recent))
}

const handleRecentEmojiClick = (emoji: string) => {
  if (checkIsUrl(emoji)) {
    emit('emojiUrlSelect', { renderUrl: resolveRecentRenderUrl(emoji), serverUrl: emoji })
  } else {
    emit('emojiSelect', emoji)
  }
  updateRecentEmojis(emoji)
}

const onEmojiHandle = (item: string | EmojiUrlPayload, type: 'emoji' | 'emoji-url' = 'emoji') => {
  if (type === 'emoji-url') {
    const payload = item as EmojiUrlPayload
    emit('emojiUrlSelect', payload)
    updateRecentEmojis(payload.serverUrl)
  } else {
    const emoji = item as string
    emit('emojiSelect', emoji)
    updateRecentEmojis(emoji)
  }
}

defineExpose({
  emojiShow,
  recentlyTip
})
</script>
