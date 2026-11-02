<template>
  <!-- G-08：房间外部关联只读展示；无数据时整块不渲染 -->
  <section
    v-if="externalIds.length > 0"
    data-testid="room-external-ids"
    class="p-12px border-b border-[--tjg-border-default] shrink-0 bg-[--tjg-surface-panel]">
    <header class="flex items-center gap-6px mb-8px">
      <svg class="size-14px color-[--tjg-text-secondary]">
        <use href="#federation"></use>
      </svg>
      <span class="text-[var(--text-sm)] font-medium color-[--tjg-text-primary] truncate">
        {{ t('home.chat_sidebar.external_ids.title') }}
      </span>
    </header>
    <ul class="flex flex-col gap-6px m-0 p-0 list-none">
      <li
        v-for="item in externalIds"
        :key="`${item.type}:${item.value}`"
        class="flex items-center gap-6px min-w-0"
        data-testid="room-external-id-row">
        <span
          class="shrink-0 px-6px py-1px rounded-4px text-[var(--text-xs)] bg-[--tjg-surface-search] color-[--tjg-text-tertiary]">
          {{ typeLabel(item.type) }}
        </span>
        <span class="text-[var(--text-xs)] color-[--tjg-text-secondary] truncate" :title="item.value">
          {{ item.value }}
        </span>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useTypedI18n } from '@/plugins/i18n'
import type { RoomExternalId } from '@/services/matrix/room/MetadataService'
import { matrixRoomReadFacade } from '@/services/matrix/room/RoomFacade'

const props = defineProps<{ roomId: string }>()

const { t } = useTypedI18n()
const externalIds = ref<RoomExternalId[]>([])
/** 房间切换竞态保护：只采纳最后一次请求的结果 */
let requestSeq = 0

const ROOM_ALIAS_TYPE = 'room_alias'

const typeLabel = (type: string): string =>
  type === ROOM_ALIAS_TYPE ? t('home.chat_sidebar.external_ids.type_room_alias') : type

const load = async (roomId: string) => {
  const seq = ++requestSeq
  if (!roomId) {
    externalIds.value = []
    return
  }
  const list = await matrixRoomReadFacade.getRoomExternalIds(roomId)
  if (seq !== requestSeq) return
  externalIds.value = list
}

watch(
  () => props.roomId,
  (roomId) => {
    void load(roomId)
  },
  { immediate: true }
)
</script>
