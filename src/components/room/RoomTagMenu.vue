<template>
  <n-dropdown
    :show="show"
    :options="menuOptions"
    :x="x"
    :y="y"
    placement="bottom-start"
    @select="handleSelect"
    @update:show="$emit('update:show', $event)" />
</template>

<script setup lang="ts">
import { computed, h } from 'vue'
import { NIcon } from 'naive-ui'
import { Icon } from '@iconify/vue'
import type { DropdownOption } from 'naive-ui'

const props = defineProps<{
  show: boolean
  x: number
  y: number
  roomId: string
  roomName?: string
  isFavorite?: boolean
  isLowPriority?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'toggle-favorite': [roomId: string]
  'toggle-low-priority': [roomId: string]
  'clear-tags': [roomId: string]
}>()

function renderIcon(iconName: string) {
  return () =>
    h(
      NIcon,
      { size: 18 },
      {
        default: () => h(Icon, { icon: iconName })
      }
    )
}

const menuOptions = computed<DropdownOption[]>(() => [
  {
    label: props.isFavorite ? '取消收藏' : '添加到收藏',
    key: 'toggle-favorite',
    icon: renderIcon(props.isFavorite ? 'ion:star' : 'ion:star-outline'),
    props: {
      style: props.isFavorite ? 'color: #fa8c16;' : ''
    }
  },
  {
    label: props.isLowPriority ? '取消低优先级' : '设为低优先级',
    key: 'toggle-low-priority',
    icon: renderIcon(props.isLowPriority ? 'ion:arrow-down' : 'ion:arrow-down-outline'),
    props: {
      style: props.isLowPriority ? 'color: #faad14;' : ''
    }
  },
  {
    type: 'divider',
    key: 'd1'
  },
  {
    label: '清除所有标签',
    key: 'clear-tags',
    icon: renderIcon('ion:close'),
    disabled: !props.isFavorite && !props.isLowPriority,
    props: {
      style: 'color: #ff4d4f;'
    }
  }
])

function handleSelect(key: string) {
  switch (key) {
    case 'toggle-favorite':
      emit('toggle-favorite', props.roomId)
      break
    case 'toggle-low-priority':
      emit('toggle-low-priority', props.roomId)
      break
    case 'clear-tags':
      emit('clear-tags', props.roomId)
      break
  }
  emit('update:show', false)
}
</script>
