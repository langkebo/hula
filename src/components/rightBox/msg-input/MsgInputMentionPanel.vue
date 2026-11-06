<template>
  <div v-if="visible" class="ait-options">
    <n-virtual-list
      id="image-chat-ait"
      ref="virtualList"
      class="max-h-180px"
      :item-size="36"
      :items="items"
      v-model:selectedKey="selectedKeyLocal">
      <template #default="{ item }">
        <n-flex
          @mouseover="() => (selectedKeyLocal = item.uid)"
          :class="{ active: selectedKey === item.uid }"
          @click="$emit('select', item)"
          :key="item.uid"
          align="center"
          class="ait-item"
          role="option"
          tabindex="0"
          :aria-selected="selectedKey === item.uid"
          :aria-label="item.myName || item.name"
          @keydown.enter.prevent="$emit('select', item)">
          <n-avatar
            lazy
            round
            :size="22"
            :src="AvatarUtils.getAvatarUrl(item.avatar)"
            color="var(--tjg-surface-panel)"
            fallback-src="/logo.png"
            :render-placeholder="() => null"
            :intersection-observer-options="{
              root: '#image-chat-ait'
            }" />
          <span>{{ item.myName || item.name }}</span>
        </n-flex>
      </template>
    </n-virtual-list>
  </div>
</template>

<script setup lang="ts">
import type { VirtualListInst } from 'naive-ui'
import type { UserItem } from '@/services/types.ts'
import { AvatarUtils } from '@/utils/AvatarUtils'

interface Props {
  visible: boolean
  items: UserItem[]
  selectedKey: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'update:selectedKey', value: string | null): void
  (event: 'select', item: UserItem): void
}>()

const virtualList = ref<VirtualListInst>()

const selectedKeyLocal = computed({
  get: () => props.selectedKey,
  set: (value: string | null) => emit('update:selectedKey', value)
})

defineExpose({ virtualList })
</script>

<style scoped lang="scss">
.ait-options {
  @apply z-999 w-200px h-fit max-h-190px bg-[--tjg-surface-panel] rounded-8px p-[5px_0_5px_5px] border-(1px solid [--tjg-border-default]);
  box-shadow: var(--tjg-shadow-md);
  .ait-item {
    @apply h-26px text-[--tjg-text-primary] text-14px p-[5px_0_5px_10px] mr-5px rounded-6px cursor-pointer;
  }
}

.active {
  background-color: var(--tjg-menu-hover);
}
</style>
