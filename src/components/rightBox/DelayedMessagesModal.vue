<template>
  <n-modal
    :show="show"
    preset="card"
    :title="t('delayed_events.title')"
    class="w-[520px] max-w-[92vw]"
    @update:show="emit('update:show', $event)">
    <div class="flex flex-col gap-3">
      <!-- 定时发送当前草稿 -->
      <section>
        <div class="flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-16px h-16px">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span class="text-13px text-[--tjg-text-secondary]">{{ t('delayed_events.schedule_title') }}</span>
        </div>
        <div class="flex flex-wrap gap-2 mt-2">
          <n-button
            v-for="preset in presets"
            :key="preset.ms"
            size="small"
            :disabled="!draftAvailable"
            @click="emit('schedule', preset.ms)">
            {{ preset.label }}
          </n-button>
        </div>
        <p v-if="!draftAvailable" class="mt-2 mb-0 text-12px text-[--tjg-text-tertiary]">
          {{ t('delayed_events.schedule_hint') }}
        </p>
      </section>

      <n-divider class="my-0" />

      <!-- 待发消息列表 -->
      <section>
        <div class="flex items-center justify-between mb-2">
          <span class="text-13px text-[--tjg-text-secondary]">{{ t('delayed_events.pending.title') }}</span>
          <n-button quaternary size="tiny" :aria-label="t('delayed_events.pending.refresh')" @click="emit('refresh')">
            <template #icon>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-14px h-14px">
                <path d="M20 11a8 8 0 1 1-2.34-5.66" />
                <path d="M20 4v5h-5" />
              </svg>
            </template>
          </n-button>
        </div>

        <n-spin :show="loading">
          <div
            v-if="!items.length"
            class="flex flex-col items-center justify-center gap-2 py-6 text-[--tjg-text-tertiary]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-24px h-24px">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            <span class="text-12px">{{ t('delayed_events.pending.empty') }}</span>
          </div>

          <ul v-else class="m-0 p-0 list-none flex flex-col gap-2">
            <li
              v-for="item in items"
              :key="item.delayId"
              class="flex items-center gap-3 p-2 rounded-8px border border-[--tjg-border-layout-divider] bg-[--tjg-surface-panel]">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-13px text-[--tjg-text-primary] truncate">{{ roomName(item.roomId) }}</span>
                  <span class="text-11px text-[--tjg-text-tertiary] shrink-0">{{ formatTime(item) }}</span>
                </div>
                <p class="m-0 mt-1 text-12px text-[--tjg-text-secondary] truncate">{{ preview(item) }}</p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <n-button size="tiny" quaternary @click="emit('sendNow', item.delayId)">
                  {{ t('delayed_events.actions.send_now') }}
                </n-button>
                <n-popselect
                  :options="rescheduleOptions"
                  trigger="click"
                  @update:value="(value: number) => emit('reschedule', item.delayId, value)">
                  <n-button size="tiny" quaternary>{{ t('delayed_events.actions.reschedule') }}</n-button>
                </n-popselect>
                <n-button size="tiny" quaternary type="error" @click="emit('cancel', item.delayId)">
                  {{ t('delayed_events.actions.cancel') }}
                </n-button>
              </div>
            </li>
          </ul>
        </n-spin>
      </section>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { DelayedMessageInfo } from '@/services/matrix/messaging/MatrixDelayedEventsService'
import { formatChatTime } from '@/utils/ComputedTime'

const props = defineProps<{
  show: boolean
  items: DelayedMessageInfo[]
  loading: boolean
  draftAvailable: boolean
  roomNames: Record<string, string>
}>()

const emit = defineEmits<{
  (event: 'update:show', value: boolean): void
  (event: 'schedule', delayMs: number): void
  (event: 'cancel', delayId: number): void
  (event: 'sendNow', delayId: number): void
  (event: 'reschedule', delayId: number, delayMs: number): void
  (event: 'refresh'): void
}>()

const { t } = useI18n()

const PRESET_DELAYS = [
  { ms: 5 * 60_000, key: 'minutes_5' },
  { ms: 30 * 60_000, key: 'minutes_30' },
  { ms: 60 * 60_000, key: 'minutes_60' },
  { ms: 180 * 60_000, key: 'minutes_180' }
]

const presets = computed(() =>
  PRESET_DELAYS.map((preset) => ({ ms: preset.ms, label: t(`delayed_events.presets.${preset.key}`) }))
)
const rescheduleOptions = computed(() => presets.value.map((preset) => ({ label: preset.label, value: preset.ms })))

const roomName = (roomId: string): string => props.roomNames[roomId] || t('delayed_events.pending.unknown_room')

const formatTime = (item: DelayedMessageInfo): string =>
  formatChatTime(item.scheduledAt + item.delayMs, { detail: true })

const preview = (item: DelayedMessageInfo): string => {
  const body = item.content?.body
  return typeof body === 'string' ? body : ''
}
</script>
