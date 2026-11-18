<template>
  <van-popup :show="show" position="bottom" round @update:show="emit('update:show', $event)">
    <div class="members-popup">
      <div class="members-popup-header">
        <span class="members-popup-title">{{ t('space.members_title') }}</span>
        <van-icon v-clickable name="cross" @click="emit('update:show', false)" />
      </div>
      <div class="members-popup-body">
        <SpaceMemberList v-if="spaceId" :space-id="spaceId" :can-manage="canManage" />
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SpaceMemberList from '@/mobile/components/space/SpaceMemberList.vue'

defineOptions({ name: 'SpaceMembersPopup' })

defineProps<{
  show: boolean
  spaceId: string
  canManage: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const { t } = useI18n()
</script>

<style scoped lang="scss">
.members-popup {
  display: flex;
  flex-direction: column;
  height: 70vh;
  padding: 16px;
  background: var(--tjg-glass-row-bg);

  .members-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;

    .members-popup-title {
      font-size: var(--tjg-font-size-md);
      font-weight: 500;
      color: var(--tjg-text-primary);
    }
  }

  .members-popup-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
