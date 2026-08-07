<template>
  <n-modal
    :show="show"
    @update:show="$emit('update:show', $event)"
    :mask-closable="true"
    class="rounded-8px"
    role="dialog"
    aria-modal="true">
    <div class="bg-[--tjg-surface-elevated] w-440px box-border rounded-8px p-20px flex flex-col">
      <div class="text-14px text-[--tjg-text-primary] mb-12px text-center">
        {{ t('components.avatarGallery.title') }}
      </div>
      <div class="grid grid-cols-5 gap-10px max-h-360px overflow-y-auto">
        <button
          v-for="avatar in avatarList"
          :key="avatar.id"
          class="size-64px rounded-50% overflow-hidden cursor-pointer hover:ring-2 hover:ring-[--tjg-color-primary-500] transition-all"
          :title="avatar.name"
          @click="handleSelect(avatar.url)">
          <img :src="avatar.url" :alt="avatar.name" class="size-full object-cover" loading="lazy" />
        </button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAvatarGallery } from '@/composables/user/useAvatarGallery'

const { t } = useI18n()
const { avatarList } = useAvatarGallery()

defineProps<{ show: boolean }>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  select: [url: string]
}>()

function handleSelect(url: string) {
  emit('select', url)
  emit('update:show', false)
}
</script>
