<template>
  <Teleport to="body">
    <!-- G-08：消息视角浮层（只读）；字段缺失时不渲染统计块 -->
    <div
      v-if="visible"
      class="fixed inset-0 z-900 flex items-center justify-center p-16px"
      role="dialog"
      aria-modal="true"
      :aria-label="t('message.event_perspective.title')"
      data-testid="message-perspective-overlay">
      <div
        class="absolute inset-0 bg-[--tjg-overlay-mask-default]"
        @click="close"
        data-testid="message-perspective-mask" />
      <section
        class="relative w-420px max-w-full max-h-80vh flex flex-col overflow-hidden rounded-12px bg-[--tjg-surface-panel] shadow-lg">
        <header
          class="flex items-center justify-between gap-8px px-16px py-12px border-b border-[--tjg-border-default]">
          <div class="flex items-center gap-8px min-w-0">
            <svg class="size-16px shrink-0 color-[--tjg-color-primary-500]">
              <use href="#info"></use>
            </svg>
            <div class="flex flex-col min-w-0">
              <span class="text-[var(--text-base)] font-medium color-[--tjg-text-primary] truncate">
                {{ t('message.event_perspective.title') }}
              </span>
              <span class="text-[var(--text-xs)] color-[--tjg-text-tertiary] truncate">
                {{ t('message.event_perspective.subtitle') }}
              </span>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 flex items-center justify-center size-24px rounded-6px bg-transparent border-none cursor-pointer hover:bg-[--tjg-menu-hover]"
            :aria-label="t('common.close')"
            data-testid="message-perspective-close"
            @click="close">
            <svg class="size-14px color-[--tjg-text-secondary]">
              <use href="#close"></use>
            </svg>
          </button>
        </header>

        <div class="flex flex-col gap-12px p-16px overflow-auto">
          <p
            v-if="state === 'loading'"
            class="text-[var(--text-sm)] color-[--tjg-text-tertiary]"
            data-testid="message-perspective-status">
            {{ t('message.event_perspective.loading') }}
          </p>
          <p
            v-else-if="state === 'unsupported'"
            class="text-[var(--text-sm)] color-[--tjg-text-tertiary]"
            data-testid="message-perspective-status">
            {{ t('message.event_perspective.unsupported') }}
          </p>
          <p
            v-else-if="state === 'error'"
            class="text-[var(--text-sm)] color-[--tjg-color-danger-500]"
            data-testid="message-perspective-status">
            {{ t('message.event_perspective.error') }}
          </p>
          <p
            v-else-if="state === 'empty'"
            class="text-[var(--text-sm)] color-[--tjg-text-tertiary]"
            data-testid="message-perspective-status">
            {{ t('message.event_perspective.empty') }}
          </p>

          <template v-else-if="state === 'ok' && stats">
            <div class="rounded-8px p-12px bg-[--tjg-surface-search] flex flex-col gap-4px">
              <span class="text-[var(--text-xs)] color-[--tjg-text-tertiary]">
                {{ t('message.event_perspective.event_count') }}
              </span>
              <span
                class="text-[var(--text-lg)] font-medium color-[--tjg-text-primary]"
                data-testid="perspective-event-count">
                {{ stats.eventCount }}
              </span>
            </div>

            <div
              v-if="stats.latestEventId"
              class="flex items-center justify-between gap-8px min-w-0 rounded-8px px-12px py-8px bg-[--tjg-surface-search]">
              <span class="text-[var(--text-xs)] color-[--tjg-text-tertiary] shrink-0">
                {{ t('message.event_perspective.latest_event_id') }}
              </span>
              <span class="text-[var(--text-xs)] color-[--tjg-text-secondary] truncate" :title="stats.latestEventId">
                {{ stats.latestEventId }}
              </span>
            </div>

            <section v-if="topSenders.length > 0" data-testid="perspective-senders">
              <h3 class="m-0 mb-8px text-[var(--text-sm)] font-medium color-[--tjg-text-primary]">
                {{ t('message.event_perspective.sender_activity') }}
              </h3>
              <ul class="flex flex-col gap-6px m-0 p-0 list-none">
                <li v-for="row in topSenders" :key="row.userId" class="flex flex-col gap-2px">
                  <div class="flex items-center justify-between gap-8px text-[var(--text-xs)]">
                    <span class="color-[--tjg-text-secondary] truncate" :title="row.userId">{{ row.userId }}</span>
                    <span class="color-[--tjg-text-tertiary] shrink-0">{{ row.count }}</span>
                  </div>
                  <div class="h-2px rounded-2px bg-[--tjg-surface-search]">
                    <div
                      class="h-2px rounded-2px bg-[--tjg-color-primary-500]"
                      :style="{ width: widthPercent(row.count, topSenderMax) }" />
                  </div>
                </li>
              </ul>
            </section>

            <section v-if="stats.eventTypes.length > 0" data-testid="perspective-types">
              <h3 class="m-0 mb-8px text-[var(--text-sm)] font-medium color-[--tjg-text-primary]">
                {{ t('message.event_perspective.event_types') }}
              </h3>
              <ul class="flex flex-col gap-6px m-0 p-0 list-none">
                <li v-for="row in topTypes" :key="row.type" class="flex flex-col gap-2px">
                  <div class="flex items-center justify-between gap-8px text-[var(--text-xs)]">
                    <span class="color-[--tjg-text-secondary] truncate" :title="row.type">{{ row.type }}</span>
                    <span class="color-[--tjg-text-tertiary] shrink-0">{{ row.count }}</span>
                  </div>
                  <div class="h-2px rounded-2px bg-[--tjg-surface-search]">
                    <div
                      class="h-2px rounded-2px bg-[--tjg-color-primary-500]"
                      :style="{ width: widthPercent(row.count, topTypeMax) }" />
                  </div>
                </li>
              </ul>
            </section>
          </template>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum } from '@/enums'
import { useTypedI18n } from '@/plugins/i18n'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'
import type { RoomEventPerspectiveStats } from '@/services/matrix/room/TimelineService'

interface PerspectivePayload {
  roomId?: string
  eventId?: string
}

type PerspectiveState = 'loading' | 'ok' | 'empty' | 'unsupported' | 'error'

const TOP_ROWS = 5

const { t } = useTypedI18n()
const visible = ref(false)
const state = ref<PerspectiveState>('loading')
const stats = ref<RoomEventPerspectiveStats | null>(null)
/** 关闭/重新打开时递增，丢弃过期的异步结果 */
let requestSeq = 0

const topSenders = computed(() => (stats.value ? stats.value.senderActivity.slice(0, TOP_ROWS) : []))
const topTypes = computed(() => (stats.value ? stats.value.eventTypes.slice(0, TOP_ROWS) : []))
const topSenderMax = computed(() => topSenders.value[0]?.count ?? 0)
const topTypeMax = computed(() => topTypes.value[0]?.count ?? 0)

const widthPercent = (count: number, max: number): string => (max > 0 ? `${Math.round((count / max) * 100)}%` : '0%')

const close = () => {
  requestSeq += 1
  visible.value = false
}

const load = async (roomId: string, eventId: string) => {
  const seq = ++requestSeq
  state.value = 'loading'
  stats.value = null
  const outcome = await matrixRoomReadFacade.getRoomEventPerspective(roomId, eventId)
  if (seq !== requestSeq) return
  if (outcome.status === 'ok') {
    stats.value = outcome.stats
    state.value = 'ok'
    return
  }
  state.value = outcome.status
}

useMitt.on(MittEnum.OPEN_EVENT_PERSPECTIVE, (payload) => {
  const data = payload as PerspectivePayload
  if (!data?.roomId || !data?.eventId) return
  visible.value = true
  void load(data.roomId, data.eventId)
})

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && visible.value) close()
}

window.addEventListener('keydown', handleKeydown)
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>
