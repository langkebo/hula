<template>
  <div class="friends-list-shell" role="main">
    <div class="min-h-0 flex-1" role="region">
      <FriendListView class="h-full" />
    </div>
  </div>
</template>

<script setup lang="ts">
import FriendListView from '@/components/friend/FriendListView.vue'

defineOptions({ name: 'friendsList' })
</script>

<style scoped lang="scss">
.friends-list-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--tjg-surface-panel);
}
</style>
