<template>
  <div class="friends-list-shell">
    <FriendListView class="h-full" />
  </div>
</template>

<script setup lang="ts" name="friendsList">
import FriendListView from '@/components/friend/FriendListView.vue'
</script>

<style scoped lang="scss">
.friends-list-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--hula-surface-panel);
}
</style>
