<template>
  <div class="manage-group-member">
    <div class="placeholder">成员管理功能正在迁移中</div>
    <n-button size="small" @click="emit('close')">关闭</n-button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  roomId: string
}>()

const emit = defineEmits<(e: 'close') => void>()
</script>

<style scoped lang="scss">
.manage-group-member {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 120px;
}

.placeholder {
  color: var(--text-color-2);
  font-size: 14px;
}
</style>
