<template>
  <div class="details-panel">
    <SingleDetails v-if="content.type === RoomTypeEnum.SINGLE" :content="content" />
    <GroupDetails v-else-if="content.type === RoomTypeEnum.GROUP" :content="content" />
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue'
import GroupDetails from '@/components/rightBox/GroupDetails.vue'
import SingleDetails from '@/components/rightBox/SingleDetails.vue'
import { RoomTypeEnum } from '@/enums'

defineProps({
  content: {
    type: Object as PropType<{ type: RoomTypeEnum; uid: string }>,
    required: false,
    default: () => ({ type: RoomTypeEnum.SINGLE, uid: '' })
  }
})
</script>

<style scoped lang="scss">
.details-panel {
  height: 100%;
  padding: 24px 20px;
  box-sizing: border-box;
}
</style>
