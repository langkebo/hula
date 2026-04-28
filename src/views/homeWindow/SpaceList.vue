<template>
  <RoomSpaceWorkbench
    ref="workbenchRef"
    :session-list="filteredSessionList"
    :total-count="sessionList.length"
    :spaces="spaces"
    :space-loading="spaceLoading"
    :selected-space-id="selectedSpaceId"
    :search-keyword="searchKeyword"
    :session-type-filter="sessionTypeFilter"
    :session-sort="sessionSort"
    :active-space="activeSpace"
    :can-manage-active-space="canManageSelectedSpace"
    :selected-session="selectedSession"
    :sync-loading="syncLoading"
    :session-loading="chatStore.sessionOptions.isLoading"
    :network-banner="networkBanner"
    :on-retry-network="retrySessions"
    :get-item-classes="getItemClasses"
    :visible-menu="visibleMenu"
    :visible-special-menu="visibleSpecialMenu"
    :on-msg-click="handleMsgClick"
    :on-msg-dblclick="handleMsgDblclick"
    :on-menu-show="handleMenuShow"
    @update:selected-space-id="setSelectedSpaceId"
    @update:search-keyword="setSearchKeyword"
    @update:session-type-filter="setSessionTypeFilter"
    @update:session-sort="setSessionSort"
    @create-space="openCreateSpace"
    @invite-space-member="openInviteSpaceMember"
    @add-space-room="openAddSpaceRoom"
    @open-space-settings="openSpaceSettings" />

  <n-modal v-model:show="showInviteModal" preset="card" :title="t('space.invite_title')" style="width: 480px">
    <n-form :model="inviteForm">
      <n-form-item :label="t('space.invite')">
        <n-input v-model:value="inviteForm.userId" :placeholder="t('space.invite_user_placeholder')" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-flex justify="flex-end" :size="12">
        <n-button @click="showInviteModal = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="inviteMutating" @click="submitInviteSpaceMember">
          {{ t('common.confirm') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>

  <n-modal v-model:show="showAddRoomModal" preset="card" :title="t('space.add_room_title')" style="width: 480px">
    <n-form :model="addRoomForm">
      <n-form-item :label="t('space.add_room')">
        <n-input v-model:value="addRoomForm.roomId" :placeholder="t('space.add_room_placeholder')" />
      </n-form-item>
      <n-form-item>
        <n-checkbox v-model:checked="addRoomForm.suggested">{{ t('space.add_room_suggested') }}</n-checkbox>
      </n-form-item>
    </n-form>
    <template #footer>
      <n-flex justify="flex-end" :size="12">
        <n-button @click="showAddRoomModal = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="addRoomMutating" @click="submitAddSpaceRoom">
          {{ t('common.confirm') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>

  <n-modal v-model:show="showSettingsModal" preset="card" :title="t('space.settings_title')" style="width: 520px">
    <n-form :model="settingsForm" label-placement="left" label-width="80">
      <n-form-item :label="t('space.name')">
        <n-input v-model:value="settingsForm.name" :placeholder="t('space.name_placeholder')" />
      </n-form-item>
      <n-form-item :label="t('space.topic')">
        <n-input
          v-model:value="settingsForm.topic"
          type="textarea"
          :placeholder="t('space.topic_placeholder')"
          :rows="3" />
      </n-form-item>
    </n-form>
    <template #footer>
      <n-flex justify="flex-end" :size="12">
        <n-button @click="showSettingsModal = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="settingsMutating" @click="submitSpaceSettings">
          {{ t('common.confirm') }}
        </n-button>
      </n-flex>
    </template>
  </n-modal>
</template>
<script lang="ts" setup name="spaceList">
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useMessage as useNaiveMessage } from 'naive-ui'
import { MittEnum, RoomTypeEnum } from '@/enums'
import { useSessionPageSync } from '@/composables/workbench/useSessionPageSync'
import { useSessionListState } from '@/composables/workbench/useSessionListState'
import { openMsgSession } from '@/hooks/session/openMsgSession'
import { useMessage } from '@/hooks/useMessage.ts'
import { useMitt } from '@/hooks/useMitt'
import { useTauriListener } from '@/hooks/useTauriListener'
import type { SpaceOptions } from '@/services/matrix/room/MatrixSpaceService'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useSpace, useSpaceMembers, useSpaceRooms } from '@/composables/space'
import { useI18n } from 'vue-i18n'
import { canManageSpaceByPowerLevel } from '@/composables/workbench/spacePermissions'
import { useRoomSpaceWorkbench } from '@/composables/workbench/useRoomSpaceWorkbench'
import RoomSpaceWorkbench from '@/components/workbench/RoomSpaceWorkbench.vue'
import { buildCreateSpaceRoute } from '@/router/spaceNavigation'

const { t } = useI18n()
const message = useNaiveMessage()
const router = useRouter()
const appWindow = WebviewWindow.getCurrent()
const { addListener } = useTauriListener()
const { handleMsgClick, handleMsgDelete, handleMsgDblclick, visibleMenu, visibleSpecialMenu } = useMessage()
const {
  chatStore,
  globalStore,
  groupStore,
  syncLoading,
  networkBanner,
  retrySessions,
  sessionList,
  selectedSession,
  handleMenuShow,
  getItemClasses,
  invalidateSessionCache
} = useSessionListState()

const {
  spaces,
  spaceLoading,
  selectedSpaceId,
  activeSpace,
  searchKeyword,
  sessionTypeFilter,
  sessionSort,
  filteredSessionList,
  setSelectedSpaceId,
  setSearchKeyword,
  setSessionTypeFilter,
  setSessionSort,
  ensureRoomVisible,
  reloadSpaces,
  reloadActiveSpaceRooms
} = useRoomSpaceWorkbench(sessionList)

const workbenchRef = ref<InstanceType<typeof RoomSpaceWorkbench> | null>(null)
const showInviteModal = ref(false)
const showAddRoomModal = ref(false)
const showSettingsModal = ref(false)
const inviteForm = reactive({ userId: '' })
const addRoomForm = reactive({ roomId: '', suggested: false })
const settingsForm = reactive({ name: '', topic: '' })
const {
  space: selectedSpaceDetail,
  load: loadSelectedSpace,
  update: updateSelectedSpace,
  mutating: settingsMutating
} = useSpace(() => selectedSpaceId.value)
const { invite: inviteSpaceMember, mutating: inviteMutating } = useSpaceMembers(() => selectedSpaceId.value)
const { addRoom: addRoomToSpace, mutating: addRoomMutating } = useSpaceRooms(() => selectedSpaceId.value)

const canManageSelectedSpace = computed(() => {
  const spaceId = selectedSpaceId.value
  return canManageSpaceByPowerLevel(matrixClientService.getClient(), spaceId)
})

const openCreateSpace = () => {
  void router.push(buildCreateSpaceRoute())
}

const openInviteSpaceMember = () => {
  if (!selectedSpaceId.value || !canManageSelectedSpace.value) return
  inviteForm.userId = ''
  showInviteModal.value = true
}

const openAddSpaceRoom = () => {
  if (!selectedSpaceId.value || !canManageSelectedSpace.value) return
  addRoomForm.roomId = ''
  addRoomForm.suggested = false
  showAddRoomModal.value = true
}

const openSpaceSettings = async () => {
  if (!selectedSpaceId.value || !canManageSelectedSpace.value) return
  await loadSelectedSpace()
  settingsForm.name = selectedSpaceDetail.value?.name ?? activeSpace.value?.name ?? ''
  settingsForm.topic = selectedSpaceDetail.value?.topic ?? ''
  showSettingsModal.value = true
}

const submitInviteSpaceMember = async () => {
  const userId = inviteForm.userId.trim()
  if (!userId) {
    message.warning(t('space.invite_user_required'))
    return
  }

  const ok = await inviteSpaceMember(userId)
  if (!ok) {
    message.error(t('space.invite_failed'))
    return
  }

  message.success(t('space.invite_success'))
  showInviteModal.value = false
}

const submitAddSpaceRoom = async () => {
  const roomId = addRoomForm.roomId.trim()
  if (!roomId) {
    message.warning(t('space.add_room_required'))
    return
  }

  const ok = await addRoomToSpace(roomId, { suggested: addRoomForm.suggested })
  if (!ok) {
    message.error(t('space.add_room_failed'))
    return
  }

  await Promise.all([reloadSpaces(), reloadActiveSpaceRooms()])
  message.success(t('space.add_room_success'))
  showAddRoomModal.value = false
}

const submitSpaceSettings = async () => {
  const nextName = settingsForm.name.trim()
  if (!nextName) {
    message.warning(t('space.name_required'))
    return
  }

  const currentName = selectedSpaceDetail.value?.name ?? activeSpace.value?.name ?? ''
  const currentTopic = selectedSpaceDetail.value?.topic ?? ''
  const payload: Partial<SpaceOptions> = {}

  if (nextName !== currentName) {
    payload.name = nextName
  }
  if (settingsForm.topic !== currentTopic) {
    payload.topic = settingsForm.topic
  }

  if (!Object.keys(payload).length) {
    showSettingsModal.value = false
    return
  }

  const ok = await updateSelectedSpace(payload)
  if (!ok) {
    message.error(t('space.settings_failed'))
    return
  }

  await reloadSpaces()
  message.success(t('space.settings_success'))
  showSettingsModal.value = false
}

watch(selectedSpaceId, (spaceId) => {
  if (spaceId) return
  showInviteModal.value = false
  showAddRoomModal.value = false
  showSettingsModal.value = false
})
useSessionPageSync({
  activePath: '/spaceList',
  handleMsgClick,
  beforeHandleSession: ensureRoomVisible
})

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
    ensureRoomVisible(e.roomId)
    const index = filteredSessionList.value.findIndex((item) => item.roomId === e.roomId)
    if (index !== -1) {
      await workbenchRef.value?.scrollToSessionIndex(index)
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
