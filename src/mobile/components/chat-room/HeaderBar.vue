<template>
  <HeaderBar
    :msg-count="props.msgCount"
    :is-official="props.isOfficial"
    :hidden-right="props.hiddenRight"
    :room-name="props.roomName"
    :border="props.border"
    :show-desktop-icon="true"
    :show-more-icon="true"
    @room-name-click="handleRoomNameClick"
    @more-click="handleMoreClick"
  />
</template>

<script setup lang="ts">
import HeaderBar, { type HeaderBarProps } from '@/mobile/components/HeaderBar.vue'
import router from '@/router'

const props = withDefaults(defineProps<HeaderBarProps>(), {
  isOfficial: true,
  hiddenRight: false,
  enableDefaultBackground: true,
  enableShadow: true,
  roomName: false,
  border: false
})

const emits = defineEmits<(e: 'roomNameClick', payload: HeaderBarProps) => void>()

const handleRoomNameClick = (payload: HeaderBarProps) => {
  emits('roomNameClick', payload)
}

const handleMoreClick = () => {
  router.push(`/mobile/chatRoom/setting`)
}
</script>
