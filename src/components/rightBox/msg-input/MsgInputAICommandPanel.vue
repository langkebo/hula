<template>
  <div v-if="visible" class="AI-options">
    <n-virtual-list
      ref="virtualList"
      class="max-h-180px"
      :item-size="36"
      :items="items"
      v-model:selectedKey="selectedKeyLocal">
      <template #default="{ item }">
        <n-flex
          @mouseover="() => (selectedKeyLocal = item.uid)"
          :class="{ active: selectedKey === item.uid }"
          @click="$emit('select')"
          align="center"
          class="AI-item">
          <n-flex align="center" justify="space-between" class="w-full pr-6px">
            <n-flex align="center">
              <img
                class="size-18px object-contain"
                :src="item.avatar"
                :alt="t('common.avatar_alt', { name: item.name })" />
              <p class="text-(14px [--tjg-text-primary])">{{ item.name }}</p>
            </n-flex>

            <n-flex align="center" :size="6">
              <div
                class="ml-6px p-[4px_8px] size-fit bg-[--tjg-color-beta-100] rounded-6px text-(11px [--tjg-color-beta-500] center)">
                Beta
              </div>
              <n-tag size="small" class="text-[length:var(--tjg-font-size-xs)]" :bordered="false" type="success">
                128k
              </n-tag>
            </n-flex>
          </n-flex>
        </n-flex>
      </template>
    </n-virtual-list>
  </div>
</template>

<script setup lang="ts">
import type { VirtualListInst } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { AIModel } from '@/services/types.ts'

interface Props {
  visible: boolean
  items: AIModel[]
  selectedKey: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (event: 'update:selectedKey', value: string | null): void
  (event: 'select'): void
}>()

const { t } = useI18n()

const virtualList = ref<VirtualListInst>()

const selectedKeyLocal = computed({
  get: () => props.selectedKey,
  set: (value: string | null) => emit('update:selectedKey', value)
})

defineExpose({ virtualList })
</script>

<style scoped lang="scss">
.AI-options {
  @apply z-999 w-260px h-fit max-h-190px bg-[--tjg-surface-panel] rounded-8px p-[5px_0_5px_5px] border-(1px solid [--tjg-border-default]);
  box-shadow: var(--tjg-shadow-md);
  .AI-item {
    @apply h-26px text-[--tjg-text-primary] text-14px p-[5px_0_5px_10px] mr-7px rounded-6px cursor-pointer;
  }
}

.active {
  background-color: var(--tjg-menu-hover);
}
</style>
