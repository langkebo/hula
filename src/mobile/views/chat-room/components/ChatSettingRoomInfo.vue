<template>
  <div class="bg-[--tjg-surface-panel] rounded-10px">
    <div class="p-15px!">
      <div v-clickable class="flex justify-between items-center" @click="handleCopy(activeItem?.account || '')">
        <div class="text-14px">
          {{
            t('mobile_chat_setting.id_card.qr_code_label', {
              t: isGroup
                ? t('mobile_chat_setting.id_card.type.group')
                : t('mobile_chat_setting.id_card.type.single_chat')
            })
          }}
        </div>
        <div class="text-12px text-[--tjg-text-secondary] flex flex-wrap gap-10px items-center">
          <div>{{ activeItem?.account || '' }}</div>
          <div>
            <svg class="w-14px h-14px iconpark-icon">
              <use href="#saoma-i3589iic"></use>
            </svg>
          </div>
        </div>
      </div>
    </div>
    <div class="mx-15px border-b border-[--tjg-border-default]"></div>
    <!-- 公告内容 -->
    <div v-if="isGroup" v-clickable class="flex flex-col text-14px gap-10px p-15px" @click="goToNotice">
      <div>{{ t('mobile_chat_setting.group_notice.title') }}</div>
      <div class="text-[--tjg-text-secondary] line-clamp-2 text-12px line-height-20px">
        {{ announcements.length > 0 ? announcements[0]?.content : '' }}
      </div>
    </div>

    <div v-if="isGroup" class="mx-15px border-b border-[--tjg-border-default]"></div>

    <!-- 群名称 -->
    <div class="flex justify-between p-15px items-center">
      <div class="text-14px">{{ t('mobile_chat_setting.group_name') }}</div>
      <div class="text-12px text-[--tjg-text-secondary] flex flex-wrap gap-10px items-center">
        <van-field
          v-model="nameValue"
          :border="false"
          input-align="right"
          :placeholder="t('mobile_chat_setting.input.group_name')"
          @blur="handleGroupInfoUpdate"
          class="!bg-transparent !p-0 !min-w-0 inline-block" />
      </div>
    </div>

    <div class="mx-15px border-b border-[--tjg-border-default]"></div>

    <!-- 群别名 -->
    <div v-if="isGroup" class="flex justify-between p-15px items-center">
      <div class="text-14px">{{ t('mobile_chat_setting.group_alias') }}</div>
      <div class="text-12px text-[--tjg-text-secondary] flex flex-wrap gap-10px items-center">
        <van-field
          v-model="nicknameValue"
          :border="false"
          input-align="right"
          :placeholder="t('mobile_chat_setting.input.group_alias')"
          @blur="handleInfoUpdate"
          class="!bg-transparent !p-0 !min-w-0 inline-block" />
      </div>
    </div>
  </div>

  <ChatRemarkField v-model="remarkValue" @blur="handleInfoUpdate" />
  <ContactAliasField v-if="!isGroup && friend?.userId" :user-id="friend.userId" />
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useClipboard } from '@/composables/common/useClipboard'
import { useMyRoomInfoUpdater } from '@/composables/room/useMyRoomInfoUpdater'
import { RoomTypeEnum } from '@/enums'
import ChatRemarkField from '@/mobile/components/chat-room/ChatRemarkField.vue'
import ContactAliasField from '@/mobile/components/chat-room/ContactAliasField.vue'
import router from '@/router'
import { matrixRoomActionFacade } from '@/services/matrix/room/RoomFacade'
import { useChatStore } from '@/stores/domains/chat/chat'
import { useContactStore } from '@/stores/domains/chat/contacts'
import type { MatrixGroupInfo } from '@/stores/domains/chat/group'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

defineOptions({
  name: 'ChatSettingRoomInfo'
})

const props = defineProps<{
  avatarMxc: string
  groupInfo: MatrixGroupInfo | null
  announcements: Array<{ content?: string }>
  initialRemark: string
}>()

const logger = createLogger('ChatSettingRoomInfo')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const { write: writeClipboard } = useClipboard()
const { persistMyRoomInfo } = useMyRoomInfoUpdater()

const chatStore = useChatStore()
const globalStore = useGlobalStore()
const contactStore = useContactStore()
const { currentSession: activeItem } = storeToRefs(globalStore)

const isGroup = computed(() => globalStore.currentSession?.type === RoomTypeEnum.GROUP)
const title = computed(() =>
  isGroup.value ? t('mobile_chat_setting.type.group') : t('mobile_chat_setting.type.single_chat')
)
const friend = computed(() => contactStore.contactsList.find((item) => item.userId === activeItem.value?.detailId))

const remarkValue = ref('')
const nameValue = ref('')
const nicknameValue = ref('')

const initialRemarkValue = ref('')
const initialNicknameValue = ref('')
const initialNameValue = ref('')

const seedGroupInfo = (info: MatrixGroupInfo | null) => {
  if (!info) return
  nameValue.value = info.groupName || info.name || ''
  nicknameValue.value = info.myName || ''
  remarkValue.value = info.remark || ''
  initialNameValue.value = nameValue.value
  initialNicknameValue.value = nicknameValue.value
  initialRemarkValue.value = remarkValue.value
}

watch(() => props.groupInfo, seedGroupInfo, { immediate: true })

watch(
  () => props.initialRemark,
  (val) => {
    if (!val) return
    remarkValue.value = val
    initialRemarkValue.value = val
  },
  { immediate: true }
)

const handleCopy = (val: string) => {
  if (!val) return
  void writeClipboard(val).catch((err) => logger.error('Copy failed:', err))
  showFeedback(t('mobile_chat_setting.copy_id', { id: val }), 'success')
}

const goToNotice = () => {
  router.push({
    path: '/mobile/chatRoom/notice',
    query: {
      announList: JSON.stringify(props.announcements),
      roomId: globalStore.currentSessionRoomId
    }
  })
}

const handleInfoUpdate = async () => {
  const remarkChanged = remarkValue.value !== initialRemarkValue.value
  const nicknameChanged = nicknameValue.value !== initialNicknameValue.value

  if (!remarkChanged && !nicknameChanged) {
    return
  }

  if (isGroup.value) {
    await persistMyRoomInfo({
      roomId: globalStore.currentSessionRoomId,
      remark: remarkValue.value,
      myName: nicknameValue.value
    })
    initialRemarkValue.value = remarkValue.value
    initialNicknameValue.value = nicknameValue.value
  } else {
    if (!remarkChanged) {
      return
    }

    const detailId = activeItem.value?.detailId
    if (!detailId) {
      showFeedback(t('mobile_chat_setting.get_friend_info_failed'), 'warning')
      return
    }
    await contactStore.setFriendNote(detailId, remarkValue.value)

    if (friend.value) {
      // 「备注」输入框写的是 note，本地镜像也必须写 note，不能写 remark（那是备注名）
      friend.value.note = remarkValue.value
    }
    initialRemarkValue.value = remarkValue.value
  }

  showFeedback(t('mobile_chat_setting.remark_updated', { n: title.value }), 'success')
}

const handleGroupInfoUpdate = async () => {
  const session = activeItem.value
  if (!session) return
  if (nameValue.value === initialNameValue.value) {
    return
  }

  await matrixRoomActionFacade.setRoomName(globalStore.currentSessionRoomId, nameValue.value)
  if (props.avatarMxc && props.avatarMxc !== session.avatar) {
    await matrixRoomActionFacade.setRoomAvatar(globalStore.currentSessionRoomId, props.avatarMxc)
  }
  session.avatar = props.avatarMxc
  session.name = nameValue.value
  chatStore.updateSession(globalStore.currentSessionRoomId, {
    avatar: props.avatarMxc,
    name: nameValue.value
  })

  initialNameValue.value = nameValue.value
  showFeedback(t('mobile_chat_setting.group_name_updated'), 'success')
}
</script>

<style scoped lang="scss">
:deep(.van-cell.van-field) {
  padding: 8px 0;
}

:deep(.van-cell.van-field::after) {
  display: none;
}
</style>
