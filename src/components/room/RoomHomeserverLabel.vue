<template>
  <span class="room-homeserver-label" :title="resolvedServerName" data-testid="room-homeserver-label">
    {{ resolvedServerName }}
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
 *
 * 注意：计算结果**不得**与 prop 同名（`serverName`），否则会遮蔽 prop，
 * 模板读到的到底是 prop 还是 computed 将无法从字面判断。故命名为 `resolvedServerName`。
 */
const resolvedServerName = computed(() => {
  if (props.serverName) return props.serverName
  if (!props.roomId) return ''
  return extractServerName(props.roomId) || ''
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
