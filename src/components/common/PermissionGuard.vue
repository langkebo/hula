<template>
  <!--
    §16.5.3 — Layer 2 component gate.
    Usage:
      <PermissionGuard :require="'voip'"> ... </PermissionGuard>
      <PermissionGuard :require="['admin-api', 'friend-list']" mode="hide"> ... </PermissionGuard>
    `mode="gray"` (default) keeps affordance discoverable but non-interactive.
    `mode="hide"` removes the slot entirely; use this only for admin-only UI.
  -->
  <slot v-if="granted" />
  <template v-else-if="mode === 'gray'">
    <div class="tjg-permission-gate" :aria-disabled="true" @click.capture.stop="handleDenied">
      <slot :denied="true" />
    </div>
  </template>
  <template v-else-if="mode === 'hide'">
    <!-- nothing rendered; denial is emitted to telemetry -->
  </template>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { type TjgCapability, useServerCapability } from '@/services/matrix/MatrixCapabilityService'

const props = withDefaults(
  defineProps<{
    require: TjgCapability | TjgCapability[]
    mode?: 'gray' | 'hide'
  }>(),
  { mode: 'gray' }
)

const emit = defineEmits<{
  (e: 'denied', missing: TjgCapability[]): void
  (e: 'granted'): void
}>()

const cap = useServerCapability()

const requiredList = computed<TjgCapability[]>(() => (Array.isArray(props.require) ? props.require : [props.require]))

const missing = computed<TjgCapability[]>(() => {
  const getters: Record<TjgCapability, boolean> = {
    'sliding-sync': cap.canUseSlidingSync.value,
    e2ee: cap.canUseE2EE.value,
    voip: cap.canUseVoip.value,
    'friend-list': cap.canUseFriendList.value,
    'admin-api': cap.canUseAdminApi.value
  }
  return requiredList.value.filter((name) => !getters[name])
})

const granted = computed(() => missing.value.length === 0)

function handleDenied(evt: MouseEvent): void {
  evt.preventDefault()
  emit('denied', missing.value)
}

onMounted(() => {
  if (granted.value) emit('granted')
  else emit('denied', missing.value)
})

watch(granted, (value) => {
  if (value) emit('granted')
  else emit('denied', missing.value)
})
</script>

<style scoped lang="scss">
.tjg-permission-gate {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: auto;
  filter: saturate(0.6);
  user-select: none;
}
</style>
