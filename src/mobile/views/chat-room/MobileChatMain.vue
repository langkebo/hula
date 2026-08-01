<template>
  <AutoFixHeightPage>
    <template #header>
      <HeaderBar
        ref="headerBar"
        :room-name="currentSession?.remark || currentSession?.name || ''"
        :msg-count="globalUnreadCount"
        :is-official="globalStore.currentSessionRoomId === '1'"
        @room-name-click="handleRoomNameClick" />
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
        <HuLaAssistant :active="true" :custom-model="customModelPath" class="mobile-assistant-view" />
      </div>
      <div v-else @click="handleChatMainClick" class="h-full overflow-y-auto">
        <ChatMain @scroll="handleScroll" />
      </div>
    </template>
    <template #footer>
      <MobileBatchToolbar
        v-if="showBatchToolbar"
        :room-id="globalStore.currentSessionRoomId"
        @forward="showForwardDialog = true"
        @cancel="showBatchToolbar = false" />
      <FooterBar v-else-if="!isBotSession" ref="footerBar" @location="handleLocationClick"></FooterBar>
    </template>

    <!-- 移动端消息长按操作面板 -->
    <MobileMessageActions v-model:visible="showMessageActions" @select="handleMessageActionSelect" />

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
    <MobileForwardDialog v-model:visible="showForwardDialog" :event-id="reactionEventId" :room-id="reactionRoomId" />
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { open } from '@tauri-apps/plugin-dialog'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { UserType } from '@/enums'
import router from '@/router'
import { useGlobalStore } from '@/stores/domains/widget/global'
import { createLogger } from '@/utils/Logger'

const HuLaAssistant = defineAsyncComponent(() => import('@/components/rightBox/chatBox/HuLaAssistant.vue'))

import MobileBatchToolbar from '#/components/message/MobileBatchToolbar.vue'
import LocationShare from '#/views/chat-room/LocationShare.vue'
import MobileForwardDialog from '#/views/chat-room/MobileForwardDialog.vue'

import { type AssistantModelPreset, useAssistantModelPresets } from '@/composables/chat/useAssistantModelPresets'

/**
 * 提供给子级组件触发消息操作面板的 injection key
 * 子级调用: `(eventId: string, roomId: string) => void`
 */
const MOBILE_MESSAGE_ACTIONS_INJECTION_KEY = Symbol('mobileMessageActions')

const logger = createLogger('MobileChatMain')
const { t } = useI18n()
const { showFeedback } = useActionFeedback()

defineOptions({
  name: 'mobileChatRoomDefault'
})

const globalStore = useGlobalStore()
const { currentSession } = storeToRefs(globalStore)
const globalUnreadCount = computed(() => globalStore.messageUnreadCount ?? 0)

const props = defineProps<{
  uid?: ''
}>()

const isBotSession = computed(() => globalStore.currentSession?.account === UserType.BOT)
const selectedModelKey = ref<string | null>(null)
const customModelPath = ref<string | null>(null)
const showModelPopover = ref(false)

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

/** 消息操作面板（长按菜单） */
const showMessageActions = ref(false)

/** 快捷表情回应面板 */
const showReactionPicker = ref(false)
const reactionEventId = ref('')
const reactionRoomId = ref('')

/** 位置共享面板 */
const showLocationShare = ref(false)

/** 转发对话框 */
const showForwardDialog = ref(false)

/** 多选批量操作工具栏 */
const showBatchToolbar = ref(false)

/** 子级组件（如 renderMessage/ContextMenu）调用此函数以显示操作面板 */
const showMessageActionsForEvent = (eventId: string, roomId: string) => {
  reactionEventId.value = eventId
  reactionRoomId.value = roomId
  showMessageActions.value = true
}

provide(MOBILE_MESSAGE_ACTIONS_INJECTION_KEY, showMessageActionsForEvent)

const handleMessageActionSelect = (action: string) => {
  logger.info('消息操作选中:', action)
  switch (action) {
    case 'react':
      showReactionPicker.value = true
      break
    case 'forward':
      showForwardDialog.value = true
      break
    case 'multi_select':
      showBatchToolbar.value = true
      break
    // 其他操作由子级组件自行处理
  }
}

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
  background: color-mix(in srgb, var(--hula-surface-panel) 88%, transparent);
  color: var(--hula-text-primary);
  font-size: 13px;
  border: 1px solid var(--hula-border-default);

  &.active {
    color: var(--hula-color-primary-500);
    background: color-mix(in srgb, var(--hula-color-primary-500) 16%, transparent);
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
