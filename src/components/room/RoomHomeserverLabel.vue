<template>
  <span class="room-homeserver-label" :title="serverName">
    {{ serverName }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { extractServerName } from '@/utils/userIdentity'

const props = withDefaults(
  defineProps<{
    /** 房间的 creator 或 canonical alias 中的服务器标识 */
    roomId?: string
    /** 直接传入服务器名（优先于 roomId） */
    serverName?: string
  }>(),
  {
    roomId: '',
    serverName: ''
  }
)

/**
 * 房间 homeserver 标注：复用 `extractServerName` 单一事实源
 * 禁止组件内自行 `split(':')` 解析
 */
const serverName = computed(() => {
  if (props.serverName) return props.serverName
  if (!props.roomId) return ''
  const parsed = extractServerName(props.roomId)
  // roomId 形如 !opaque:server → 只取 server 部分
  return parsed || ''
})
</script>

<style scoped lang="scss">
/* ==================== 房间 homeserver 标注 ====================
 * §2.1 — RoomHomeserverLabel：房间名旁的服务器域名 chip
 * ==================================================== */
.room-homeserver-label {
  font-size: var(--tjg-font-size-2xs);
  color: var(--tjg-color-info-600);
  background: color-mix(in srgb, var(--tjg-color-info-500) 12%, transparent);
  padding: 1px 6px;
  border-radius: var(--tjg-radius-xs);
  line-height: 1.4;
}
</style>
