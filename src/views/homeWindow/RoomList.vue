<template>
  <RoomSessionList
    ref="sessionListRef"
    :session-list="roomSessionList"
    :sync-loading="syncLoading"
    :session-loading="chatStore.sessionOptions.isLoading"
    :network-banner="networkBanner"
    :empty-description="t('message.message_list.empty_description')"
    :get-item-classes="getItemClasses"
    :visible-menu="visibleMenu"
    :visible-special-menu="visibleSpecialMenu"
    :on-msg-click="handleMsgClick"
    :on-msg-dblclick="handleMsgDblclick"
    :on-menu-show="handleMenuShow"
    :on-retry-network="retrySessions" />
</template>
<script lang="ts" setup name="roomList">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { MittEnum, RoomTypeEnum } from '@/enums'
import { useSessionPageSync } from '@/composables/workbench/useSessionPageSync'
import { useSessionListState } from '@/composables/workbench/useSessionListState'
import { openMsgSession } from '@/hooks/session/openMsgSession'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt'
import { useTauriListener } from '@/hooks/useTauriListener'
import { useI18n } from 'vue-i18n'
import RoomSessionList from '@/components/workbench/RoomSessionList.vue'

const { t } = useI18n()
const appWindow = WebviewWindow.getCurrent()
const { addListener } = useTauriListener()
const { handleMsgClick, handleMsgDelete, handleMsgDblclick, visibleMenu, visibleSpecialMenu } = useMessage()
const {
  chatStore,
  globalStore,
  syncLoading,
  networkBanner,
  retrySessions,
  sessionList,
  handleMenuShow,
  getItemClasses,
  invalidateSessionCache
} = useSessionListState()

const roomSessionList = computed(() => sessionList.value.filter((item) => item.type === RoomTypeEnum.GROUP))
const sessionListRef = ref<InstanceType<typeof RoomSessionList> | null>(null)

useSessionPageSync({ activePath: '/roomList', handleMsgClick })

onBeforeMount(async () => {
  useMitt.emit(MittEnum.LOCATE_SESSION, { roomId: globalStore.currentSessionRoomId })
})

onMounted(async () => {
  if (appWindow.label === 'home') {
    await addListener(
      appWindow.listen('search_to_msg', (event: { payload: { uid: string; roomType: number } }) => {
        openMsgSession(event.payload.uid, event.payload.roomType)
      }),
      'search_to_msg'
    )
  }
  useMitt.on(MittEnum.UPDATE_SESSION_LAST_MSG, (payload?: { roomId?: string }) => {
    invalidateSessionCache(payload?.roomId)
  })
  useMitt.on(MittEnum.DELETE_SESSION, async (roomId: string) => {
    await handleMsgDelete(roomId)
  })
  useMitt.on(MittEnum.LOCATE_SESSION, async (e: { roomId: string }) => {
    const index = roomSessionList.value.findIndex((item) => item.roomId === e.roomId)
    if (index !== -1) {
      await sessionListRef.value?.scrollToIndex(index)
    }
  })
})
</script>

<style lang="scss" scoped>
@use '@/styles/scss/message';

#image-no-data {
  @apply size-full mt-60px text-[--hula-text-primary] text-14px;
}
</style>
