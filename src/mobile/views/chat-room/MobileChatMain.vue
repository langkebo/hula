<template>
  <AutoFixHeightPage>
    <template #header>
      <HeaderBar
        ref="headerBar"
        :room-name="currentSession?.remark || currentSession?.name || ''"
        :msg-count="globalUnreadCount"
        :is-official="globalStore.currentSessionRoomId === '1'"
        :is-group="isGroupSession"
        :private-mode-active="privateModeActive"
        :federation-server="isFederated ? federationServer : ''"
        @room-name-click="handleRoomNameClick"
        @toggle-private-mode="onTogglePrivateMode" />
    </template>
    <template #container>
      <div v-if="isBotSession" class="mobile-assistant-container">
        <div class="mobile-assistant-toolbar">
          <van-popover
            v-model:show="showModelPopover"
            :actions="modelActions"
            placement="bottom-end"
            @select="handleModelActionSelect">
            <template #reference>
              <div :class="['mobile-assistant-select', { active: selectedModelKey && selectedModelKey !== 'local' }]">
                <span class="mobile-assistant-select__text">{{ selectedModelLabel }}</span>
                <svg class="mobile-assistant-select__icon"><use href="#down"></use></svg>
              </div>
            </template>
          </van-popover>
          <van-button size="small" plain type="primary" @click="handleAssistantImport">
            {{ t('mobile_chat.import_model') }}
          </van-button>
        </div>
        <TjgAssistant :active="true" :custom-model="customModelPath" class="mobile-assistant-view" />
      </div>
      <div v-else @click="handleChatMainClick" class="h-full overflow-y-auto">
        <ChatMain @scroll="handleScroll" />
      </div>
    </template>
    <template #footer>
      <MobileBatchToolbar
        v-if="!isBotSession && chatStore.isMsgMultiChoose"
        @forward="handleBatchForward"
        @exit="handleBatchExit" />
      <FooterBar v-else-if="!isBotSession" ref="footerBar" @location="handleLocationClick" />
    </template>

    <!-- 移动端快捷表情回应面板 -->
    <MobileReactionPicker
      v-model:visible="showReactionPicker"
      :room-id="reactionRoomId"
      :event-id="reactionEventId"
      @reacted="handleReacted" />

    <!-- 移动端位置共享面板 -->
    <LocationShare
      :show="showLocationShare"
      :room-id="globalStore.currentSessionRoomId"
      @update:show="showLocationShare = $event" />

    <!-- 移动端转发对话框 -->
    <MobileForwardDialog
      v-model:visible="showForwardDialog"
      :event-id="reactionEventId"
      :room-id="reactionRoomId"
      :event-ids="forwardEventIds" />

    <!-- 移动端私密模式确认对话框（van-dialog） -->
    <PrivateModeConfirmDialog
      v-model:show="showPrivateConfirm"
      @confirm="onConfirmPrivateMode"
      @cancel="onCancelPrivateMode" />
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { useMitt } from '@/composables/common/useMitt'
import { MittEnum, RoomTypeEnum, UserType } from '@/enums'
import router from '@/router'
import { matrixClientService } from '@/services/matrix/MatrixClientService'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'
import { extractServerName } from '@/utils/userIdentity'

const TjgAssistant = defineAsyncComponent(() => import('@/components/rightBox/chatBox/TjgAssistant.vue'))

import MobileBatchToolbar from '#/components/chat-room/MobileBatchToolbar.vue'
import PrivateModeConfirmDialog from '#/components/chat-room/PrivateModeConfirmDialog.vue'
import LocationShare from '#/views/chat-room/LocationShare.vue'
import MobileForwardDialog from '#/views/chat-room/MobileForwardDialog.vue'

import { type AssistantModelPreset, useAssistantModelPresets } from '@/composables/chat/useAssistantModelPresets'
import { useChatStore } from '@/stores/domains/chat/chat'

const logger = createLogger('MobileChatMain')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

defineOptions({
  name: 'mobileChatRoomDefault'
})

const globalStore = useGlobalStore()
const chatStore = useChatStore()
const { currentSession } = storeToRefs(globalStore)
const globalUnreadCount = computed(() => globalStore.messageUnreadCount ?? 0)

// 联邦判定（与 ChatHeaderRoot 单一事实源一致）
const currentSessionRoomId = computed(() => globalStore.currentSessionRoomId)
const federationServer = computed(() => extractServerName(currentSessionRoomId.value))
const isFederated = computed(() => {
  const roomServer = federationServer.value
  const localServer = extractServerName(matrixClientService.getUserId())
  return Boolean(roomServer) && roomServer !== localServer
})

const props = defineProps<{
  uid?: ''
}>()

const isBotSession = computed(() => globalStore.currentSession?.account === UserType.BOT)
const isGroupSession = computed(() => currentSession.value?.type === RoomTypeEnum.GROUP)
const selectedModelKey = ref<string | null>(null)
const customModelPath = ref<string | null>(null)
const showModelPopover = ref(false)

const privateModeActive = ref(false)
const showPrivateConfirm = ref(false)
const onPrivateModeChanged = (isActive: boolean) => {
  privateModeActive.value = isActive
}
const onTogglePrivateMode = () => {
  if (privateModeActive.value) {
    // 已激活，直接退出（ChatMain.togglePrivateMode 走已激活分支）
    useMitt.emit(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, { confirmed: false })
  } else {
    // 未激活，显示移动端确认对话框（van-dialog）
    showPrivateConfirm.value = true
  }
}
const onConfirmPrivateMode = () => {
  showPrivateConfirm.value = false
  // 用户已确认，ChatMain 直接调用 confirmPrivateMode 进入私密模式，不弹 PC 对话框
  useMitt.emit(MittEnum.PRIVATE_MODE_TOGGLE_REQUEST, { confirmed: true })
}
const onCancelPrivateMode = () => {
  showPrivateConfirm.value = false
}

onMounted(() => {
  useMitt.on(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})
onUnmounted(() => {
  useMitt.off(MittEnum.PRIVATE_MODE_CHANGED, onPrivateModeChanged)
})

const modelActions = computed(() =>
  assistantModelPresets.value.map((preset) => ({
    text: formatPresetLabel(preset),
    value: preset.modelKey
  }))
)

const { presets: assistantModelPresets, fetchAssistantModelPresets } = useAssistantModelPresets()
void fetchAssistantModelPresets()

const findPresetByKey = (key: string | null | undefined): AssistantModelPreset | undefined => {
  if (!key) return void 0
  return assistantModelPresets.value.find((preset) => preset.modelKey === key)
}

const formatPresetLabel = (preset: AssistantModelPreset) => {
  if (!preset.version || preset.modelName.includes(preset.version)) {
    return preset.modelName
  }
  return `${preset.modelName} (${preset.version})`
}

const selectedModelLabel = computed(() => {
  if (selectedModelKey.value === 'local') {
    return '本地模型'
  }
  const preset = findPresetByKey(selectedModelKey.value)
  if (preset) {
    return formatPresetLabel(preset)
  }
  const first = assistantModelPresets.value[0]
  return first ? formatPresetLabel(first) : '选择模型'
})

const handleChatMainClick = () => {
  // 移动端点击聊天区域不再自动关闭面板
  // 用户需要手动点击按钮来关闭面板
}

const handleScroll = () => {
  // 移动端滚动聊天区域不再自动关闭面板
  // 用户需要手动点击按钮来关闭面板
}

const handleRoomNameClick = () => {
  if (props.uid) {
    router.push(`/mobile/mobileFriends/friendInfo/${props.uid}`)
  }
}

const applyFirstPreset = (options?: { force?: boolean }) => {
  const firstPreset = assistantModelPresets.value[0]
  if (!firstPreset) {
    if (options?.force && selectedModelKey.value !== 'local') {
      selectedModelKey.value = null
      customModelPath.value = null
    }
    return
  }
  if (!options?.force && selectedModelKey.value === 'local') {
    return
  }
  selectedModelKey.value = firstPreset.modelKey
  customModelPath.value = firstPreset.modelUrl
}

const resetAssistantModel = (options?: { reapplyFirst?: boolean }) => {
  if (selectedModelKey.value !== 'local') {
    selectedModelKey.value = null
    customModelPath.value = null
  }
  if (options?.reapplyFirst) {
    applyFirstPreset({ force: true })
  }
}

watch(
  assistantModelPresets,
  (presets) => {
    if (!presets.length) {
      if (selectedModelKey.value !== 'local') {
        selectedModelKey.value = null
        customModelPath.value = null
      }
      return
    }
    if (selectedModelKey.value === 'local') {
      return
    }
    const current = presets.find((preset) => preset.modelKey === selectedModelKey.value)
    if (current) {
      customModelPath.value = current.modelUrl
    } else {
      applyFirstPreset({ force: true })
    }
  },
  { immediate: true }
)

watch(
  isBotSession,
  (isBot) => {
    if (isBot) {
      void fetchAssistantModelPresets(assistantModelPresets.value.length <= 1)
      applyFirstPreset({ force: true })
    } else {
      resetAssistantModel()
    }
  },
  { immediate: true }
)

watch(
  () => globalStore.currentSessionRoomId,
  () => {
    resetAssistantModel({ reapplyFirst: true })
  }
)

const handleModelActionSelect = (action: { text: string; value: string }) => {
  handleAssistantModelSelect(action.value)
  showModelPopover.value = false
}

const handleAssistantModelSelect = (key: string | number) => {
  const preset = findPresetByKey(String(key))
  if (!preset) return
  if (selectedModelKey.value === preset.modelKey && customModelPath.value === preset.modelUrl) {
    return
  }
  selectedModelKey.value = preset.modelKey
  customModelPath.value = preset.modelUrl
}

const handleAssistantImport = async () => {
  try {
    const selected = await open({
      filters: [
        {
          name: '3D Models',
          extensions: ['glb', 'gltf', 'vrm']
        }
      ],
      multiple: false
    })
    if (!selected) return
    const filePath = Array.isArray(selected) ? selected[0] : selected
    selectedModelKey.value = 'local'
    customModelPath.value = filePath
  } catch (error) {
    logger.error('选择模型文件失败:', error)
    showFeedback('选择模型文件失败，请重试', 'error')
  }
}

// ── 消息操作面板 & 快捷表情回应 ──────────────────────────

/** 快捷表情回应面板 */
const showReactionPicker = ref(false)
const reactionEventId = ref('')
const reactionRoomId = ref('')

/** 位置共享面板 */
const showLocationShare = ref(false)

/** 转发对话框 */
const showForwardDialog = ref(false)
/** 批量转发的 eventId 列表(单条转发时为空数组) */
const forwardEventIds = ref<string[]>([])

/** 子级组件（如 renderMessage/ContextMenu）通过 mitt 等通道直接触发各面板 */

const handleReacted = (emoji: string) => {
  logger.info('表情回应已添加:', emoji)
  showReactionPicker.value = false
  // 清理状态
  reactionEventId.value = ''
  reactionRoomId.value = ''
}

/** 位置共享点击处理 */
const handleLocationClick = () => {
  showLocationShare.value = true
}

/**
 * 多选模式下的转发处理
 * MobileBatchToolbar 触发 forward 事件时,设置当前源事件并打开转发对话框
 * (此时多选模式已由 toolbar 内部 exitMultiSelect 退出)
 *
 * payload.eventIds 长度为多选条数;为兼容单条链路,保持 reactionEventId 作为首条 eventId
 */
const handleBatchForward = (payload: { eventId: string; roomId: string; eventIds: string[] }): void => {
  reactionEventId.value = payload.eventId
  reactionRoomId.value = payload.roomId
  forwardEventIds.value = payload.eventIds
  showForwardDialog.value = true
}

/** 多选模式退出处理 */
const handleBatchExit = (): void => {
  // chat store 的 isMsgMultiChoose 已由 toolbar 内部清空
  // 此处仅记录日志,后续如需清理其他状态可在此扩展
  logger.info('[MobileChatMain] 退出多选模式')
}
</script>

<style lang="scss">
@use '@/styles/scss/render-message';

.mobile-assistant-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  box-sizing: border-box;
}

.mobile-assistant-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding-bottom: 12px;
}

.mobile-assistant-select {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--tjg-surface-panel) 88%, transparent);
  color: var(--tjg-text-primary);
  font-size: 13px;
  border: 1px solid var(--tjg-border-default);

  &.active {
    color: var(--tjg-color-primary-500);
    background: color-mix(in srgb, var(--tjg-color-primary-500) 16%, transparent);
  }
}

.mobile-assistant-select__text {
  white-space: nowrap;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-assistant-select__icon {
  width: 12px;
  height: 12px;
  color: currentColor;
}

.mobile-assistant-import {
  white-space: nowrap;
}

.mobile-assistant-view {
  flex: 1;
  display: flex;
}
</style>
