<template>
  <Teleport to="body">
    <!-- 已读回执明细（ROOM-03 `GET /rooms/{roomId}/receipts/{receiptType}/{eventId}`，只读） -->
    <div
      v-if="visible"
      class="fixed inset-0 z-900 flex items-center justify-center p-16px"
      role="dialog"
      aria-modal="true"
      :aria-label="t('message.event_receipts.title')"
      data-testid="event-receipts-overlay">
      <div class="absolute inset-0 bg-[--tjg-overlay-mask-default]" data-testid="event-receipts-mask" @click="close" />
      <section
        class="relative w-380px max-w-full max-h-80vh flex flex-col overflow-hidden rounded-12px bg-[--tjg-surface-panel] shadow-lg">
        <header
          class="flex items-center justify-between gap-8px px-16px py-12px border-b border-[--tjg-border-default]">
          <div class="flex items-center gap-8px min-w-0">
            <svg class="size-16px shrink-0 color-[--tjg-color-primary-500]" aria-hidden="true">
              <use href="#check" />
            </svg>
            <div class="flex flex-col min-w-0">
              <span class="text-[var(--text-base)] font-medium color-[--tjg-text-primary] truncate">
                {{ t('message.event_receipts.title') }}
              </span>
              <span class="text-[var(--text-xs)] color-[--tjg-text-tertiary] truncate">
                {{ t('message.event_receipts.subtitle', { count: readers.length }) }}
              </span>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 flex items-center justify-center size-24px rounded-[var(--tjg-radius-md)] bg-transparent border-none cursor-pointer hover:bg-[--tjg-menu-hover]"
            :aria-label="t('common.close')"
            data-testid="event-receipts-close"
            @click="close">
            <svg class="size-14px color-[--tjg-text-secondary]" aria-hidden="true">
              <use href="#close" />
            </svg>
          </button>
        </header>

        <div class="flex-1 min-h-0 overflow-auto p-16px">
          <div v-if="state === 'loading'" data-testid="event-receipts-loading" role="status" aria-live="polite">
            {{ t('common.loading') }}
          </div>

          <div
            v-else-if="state === 'error'"
            class="flex flex-col items-start gap-8px"
            data-testid="event-receipts-error">
            <span class="text-[var(--text-sm)] color-[--tjg-text-secondary]">
              {{ t('message.event_receipts.error') }}
            </span>
            <button
              type="button"
              class="text-[var(--text-sm)] color-[--tjg-color-primary-500] bg-transparent border-none cursor-pointer p-0"
              data-testid="event-receipts-retry"
              @click="reload">
              {{ t('common.retry') }}
            </button>
          </div>

          <div
            v-else-if="state === 'unsupported'"
            class="text-[var(--text-sm)] color-[--tjg-text-tertiary]"
            data-testid="event-receipts-unsupported">
            {{ t('message.event_receipts.unsupported') }}
          </div>

          <div
            v-else-if="state === 'empty'"
            class="text-[var(--text-sm)] color-[--tjg-text-tertiary]"
            data-testid="event-receipts-empty">
            {{ t('message.event_receipts.empty') }}
          </div>

          <ul v-else class="flex flex-col gap-8px list-none m-0 p-0" data-testid="event-receipts-list">
            <li
              v-for="reader in readers"
              :key="reader.userId"
              class="flex items-center justify-between gap-8px text-[var(--text-sm)]"
              data-testid="event-receipts-row">
              <span class="color-[--tjg-text-primary] truncate">{{ reader.userId }}</span>
              <span class="shrink-0 color-[--tjg-text-tertiary]">
                {{ reader.ts ? formatTime(reader.ts) : t('message.event_receipts.ts_unknown') }}
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { useTypedI18n } from '@/plugins/i18n'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'
import type { RoomReceiptUser } from '@/services/matrix/room/TimelineService'

type ReceiptsState = 'loading' | 'ok' | 'empty' | 'unsupported' | 'error'

type ReceiptsPayload = { roomId?: string; eventId?: string; receiptType?: string }

const { t } = useTypedI18n()
const visible = ref(false)
const state = ref<ReceiptsState>('loading')
const readers = ref<RoomReceiptUser[]>([])
/** 关闭/重开时递增，丢弃过期异步结果 */
let requestSeq = 0
let lastPayload: Required<ReceiptsPayload> | null = null

const formatTime = (ts: number): string => new Date(ts).toLocaleString()

const close = () => {
  requestSeq += 1
  visible.value = false
}

const load = async (payload: Required<ReceiptsPayload>) => {
  const seq = ++requestSeq
  state.value = 'loading'
  readers.value = []
  const outcome = await matrixRoomReadFacade.getRoomReceipts(payload.roomId, payload.receiptType, payload.eventId)
  if (seq !== requestSeq) return
  if (outcome.status === 'ok') {
    readers.value = outcome.snapshot.users
    state.value = outcome.snapshot.users.length > 0 ? 'ok' : 'empty'
    return
  }
  state.value = outcome.status
}

const reload = () => {
  if (lastPayload) void load(lastPayload)
}

useMitt.on(MittEnum.OPEN_EVENT_RECEIPTS, (payload) => {
  const data = payload as ReceiptsPayload
  if (!data?.roomId || !data?.eventId) return
  const normalized = { roomId: data.roomId, eventId: data.eventId, receiptType: data.receiptType || 'm.read' }
  lastPayload = normalized
  visible.value = true
  void load(normalized)
})

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && visible.value) close()
}

window.addEventListener('keydown', handleKeydown)
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))

// 供测试读取（不参与渲染逻辑）
defineExpose({ state, readers, visible })
</script>
