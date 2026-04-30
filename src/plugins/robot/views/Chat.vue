<template>
  <!-- 主体内容 -->
  <main class="chat-main-container">
    <div class="chat-content-area">
      <RobotChatHeader
        :chat-title="currentChat.title"
        :message-count="currentChat.messageCount"
        :is-edit="isEdit"
        :ai-provider="aiProvider"
        :is-open-claw-connected="isOpenClawConnected"
        :open-claw-models="openClawModels"
        :open-claw-current-model="openClawCurrentModel"
        :selected-model="selectedModel"
        :remaining-usage="remainingUsage"
        :remaining-usage-display="remainingUsageDisplay"
        :remaining-usage-tag-type="remainingUsageTagType"
        :show-delete-chat-confirm="showDeleteChatConfirm"
        :delete-with-messages="deleteWithMessages"
        @edit="handleEdit"
        @blur="handleBlur"
        @update:chat-title="currentChat.title = $event"
        @update:ai-provider="aiProvider = $event"
        @change-provider="handleProviderChange"
        @update:open-claw-current-model="openClawCurrentModel = $event"
        @update:show-delete-chat-confirm="showDeleteChatConfirm = $event"
        @update:delete-with-messages="deleteWithMessages = $event"
        @model-click="handleModelClick"
        @create-new-chat="handleCreateNewChat"
        @delete-chat="handleDeleteChat" />
      <div class="h-1px bg-[--hula-border-default]"></div>

      <!-- 聊天信息框 -->
      <RobotChatMessageList
        :class="{ 'shadow-inner': settingStore.pageShadowEnabled }"
        :message-list="messageList"
        :loading-messages="loadingMessages"
        :message-render-version="messageRenderVersion"
        :selected-model="selectedModel"
        :user-avatar="userAvatar"
        :get-model-avatar="getModelAvatar"
        :get-default-avatar="getDefaultAvatar"
        :get-message-bubble-class="getMessageBubbleClass"
        :get-ai-placeholder-text="getAiPlaceholderText"
        :is-likely-media-url="isLikelyMediaUrl"
        @preview-image="handleImagePreview"
        @delete-message="handleDeleteMessage" />
      <div class="h-1px bg-[--hula-border-default]"></div>
      <RobotChatInputPanel
        ref="MsgInputRef"
        :show-role-popover="showRolePopover"
        :selected-role="selectedRole"
        :role-list="roleList"
        :role-loading="roleLoading"
        :show-model-popover="showModelPopover"
        :selected-model="selectedModel"
        :model-search="modelSearch"
        :model-loading="modelLoading"
        :filtered-models="filteredModels"
        :official-models="officialModels"
        :user-models="userModels"
        :model-pagination="modelPagination"
        :image-params="imageParams"
        :image-size-options="imageSizeOptions"
        :video-params="videoParams"
        :video-size-options="videoSizeOptions"
        :video-duration-options="videoDurationOptions"
        :audio-params="audioParams"
        :audio-voice-options="audioVoiceOptions"
        :audio-speed-options="audioSpeedOptions"
        :video-image-preview="videoImagePreview"
        :is-uploading-video-image="isUploadingVideoImage"
        :other-features="otherFeatures"
        :server-token-usage="serverTokenUsage"
        :conversation-tokens="conversationTokens"
        :reasoning-enabled="reasoningEnabled"
        :supports-reasoning="supportsReasoning"
        :is-a-i-streaming="isAIStreaming"
        :get-default-avatar="getDefaultAvatar"
        :get-model-avatar="getModelAvatar"
        :handle-video-image-upload="handleVideoImageUpload"
        @update:show-role-popover="showRolePopover = $event"
        @update:show-model-popover="handleModelPopoverShowChange"
        @update:model-search="modelSearch = $event"
        @update:reasoning-enabled="reasoningEnabled = $event"
        @select-role="handleSelectRole"
        @open-role-management="handleOpenRoleManagement"
        @select-model="selectModel"
        @open-model-management="handleOpenModelManagement"
        @model-page-change="handleModelPageChange"
        @clear-video-image="clearVideoImage"
        @send-ai="handleSendAI"
        @stop-ai-stream="handleStopAIStream" />
    </div>
  </main>

  <!-- 历史记录弹窗 -->
  <n-modal
    v-model:show="showHistoryModal"
    preset="card"
    title="生成历史"
    style="width: 90%; max-width: 1200px"
    :bordered="false">
    <!-- 类型切换按钮 -->
    <template #header-extra>
      <n-button-group size="small">
        <n-button :type="historyType === 'image' ? 'primary' : 'default'" @click="switchHistoryType('image')">
          <template #icon>
            <Icon icon="mdi:image" />
          </template>
          图片
        </n-button>
        <n-button :type="historyType === 'audio' ? 'primary' : 'default'" @click="switchHistoryType('audio')">
          <template #icon>
            <Icon icon="mdi:music" />
          </template>
          音频
        </n-button>
        <n-button :type="historyType === 'video' ? 'primary' : 'default'" @click="switchHistoryType('video')">
          <template #icon>
            <Icon icon="mdi:video" />
          </template>
          视频
        </n-button>
      </n-button-group>
    </template>

    <n-spin :show="historyLoading">
      <div v-if="historyList.length > 0" class="history-grid">
        <div v-for="item in historyList" :key="item.id" class="history-item">
          <div class="history-wrapper">
            <!-- 图片预览 -->
            <div v-if="historyType === 'image'" class="media-preview">
              <img
                v-if="item.status === 20 && item.picUrl"
                :src="item.picUrl"
                :alt="item.prompt"
                class="preview-img"
                @click="handlePreviewImage(item)" />
              <div v-else-if="item.status === 10" class="preview-placeholder">
                <n-spin size="large" />
                <p class="text-12px text-#909090 mt-8px">生成中...</p>
              </div>
              <div v-else class="preview-placeholder error">
                <Icon icon="mdi:alert-circle-outline" class="text-48px text-#d5304f" />
                <p class="text-12px text-#d5304f mt-8px">生成失败</p>
              </div>
            </div>

            <!-- 音频预览 -->
            <div v-else-if="historyType === 'audio'" class="media-preview">
              <div v-if="item.status === 20 && item.audioUrl" class="audio-preview">
                <Icon icon="mdi:music-circle" class="text-64px text-#1890ff" />
                <p class="text-12px text-#1890ff mt-8px">点击播放</p>
              </div>
              <div v-else-if="item.status === 10" class="preview-placeholder">
                <n-spin size="large" />
                <p class="text-12px text-#909090 mt-8px">生成中...</p>
              </div>
              <div v-else class="preview-placeholder error">
                <Icon icon="mdi:alert-circle-outline" class="text-48px text-#d5304f" />
                <p class="text-12px text-#d5304f mt-8px">生成失败</p>
              </div>
            </div>

            <!-- 视频预览 -->
            <div v-else class="media-preview">
              <div v-if="item.status === 20 && item.videoUrl" class="video-preview" @click="handlePreviewVideo(item)">
                <Icon icon="mdi:play-circle" class="text-64px text-white" />
                <p class="text-12px text-white mt-8px">点击播放</p>
              </div>
              <div v-else-if="item.status === 10" class="preview-placeholder">
                <n-spin size="large" />
                <p class="text-12px text-#909090 mt-8px">生成中...</p>
              </div>
              <div v-else class="preview-placeholder error">
                <Icon icon="mdi:alert-circle-outline" class="text-48px text-#d5304f" />
                <p class="text-12px text-#d5304f mt-8px">生成失败</p>
              </div>
            </div>

            <!-- 信息 -->
            <div class="history-info">
              <p class="prompt" :title="item.prompt">{{ item.prompt }}</p>
              <p class="text-11px text-#909090 mt-4px">{{ item.width }} × {{ item.height }}</p>
            </div>
          </div>
        </div>
      </div>
      <n-empty v-else description="暂无生成记录" class="py-40px" />
    </n-spin>

    <!-- 分页 -->
    <n-flex v-if="historyPagination.total > historyPagination.pageSize" justify="center" class="mt-16px">
      <n-pagination
        v-model:page="historyPagination.pageNo"
        :page-size="historyPagination.pageSize"
        :page-count="Math.ceil(historyPagination.total / historyPagination.pageSize)"
        @update:page="handleHistoryPageChange" />
    </n-flex>
  </n-modal>

  <!-- 图片预览弹窗 -->
  <n-modal v-model:show="showImagePreview" preset="card" title="图片预览" style="width: 90%; max-width: 1000px">
    <div v-if="previewItem" class="preview-container">
      <img :src="previewItem.picUrl" :alt="previewItem.prompt" class="preview-image" />
      <div class="preview-info mt-16px">
        <p class="text-14px">
          <strong>提示词：</strong>
          {{ previewItem.prompt }}
        </p>
        <p class="text-12px text-#909090 mt-8px">
          <strong>尺寸：</strong>
          {{ previewItem.width }} × {{ previewItem.height }}
        </p>
      </div>
    </div>
  </n-modal>

  <!-- 视频预览弹窗 -->
  <n-modal v-model:show="showVideoPreview" preset="card" title="视频预览" style="width: 90%; max-width: 1000px">
    <div v-if="previewItem" class="preview-container">
      <video :src="previewItem.videoUrl" controls class="preview-video" />
      <div class="preview-info mt-16px">
        <p class="text-14px">
          <strong>提示词：</strong>
          {{ previewItem.prompt }}
        </p>
        <p class="text-12px text-#909090 mt-8px">
          <strong>尺寸：</strong>
          {{ previewItem.width }} × {{ previewItem.height }}
        </p>
      </div>
    </div>
  </n-modal>
</template>
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'
import RobotChatHeader from '@/plugins/robot/components/RobotChatHeader.vue'
import RobotChatInputPanel from '@/plugins/robot/components/RobotChatInputPanel.vue'
import RobotChatMessageList from '@/plugins/robot/components/RobotChatMessageList.vue'
import { useRobotChat } from '@/plugins/robot/composables/useRobotChat'
import { useSettingStore } from '@/stores/domains/settings/setting'

const settingStore = useSettingStore()
const MsgInputRef = ref<{ clearInput?: () => void }>()

const {
  isEdit,
  currentChat,
  remainingUsage,
  remainingUsageDisplay,
  remainingUsageTagType,
  isAIStreaming,
  messageList,
  loadingMessages,
  messageRenderVersion,
  serverTokenUsage,
  conversationTokens,
  showDeleteChatConfirm,
  deleteWithMessages,
  showRolePopover,
  selectedRole,
  roleList,
  roleLoading,
  showModelPopover,
  modelLoading,
  modelSearch,
  selectedModel,
  reasoningEnabled,
  supportsReasoning,
  modelPagination,
  filteredModels,
  officialModels,
  userModels,
  imageParams,
  imageSizeOptions,
  videoParams,
  videoSizeOptions,
  videoDurationOptions,
  audioParams,
  audioVoiceOptions,
  audioSpeedOptions,
  videoImagePreview,
  isUploadingVideoImage,
  showHistoryModal,
  historyType,
  historyLoading,
  historyList,
  historyPagination,
  showImagePreview,
  showVideoPreview,
  previewItem,
  otherFeatures,
  userAvatar,
  aiProvider,
  isOpenClawConnected,
  openClawModels,
  openClawCurrentModel,
  handleProviderChange,
  getDefaultAvatar,
  getModelAvatar,
  getMessageBubbleClass,
  getAiPlaceholderText,
  isLikelyMediaUrl,
  handleVideoImageUpload,
  clearVideoImage,
  handleSendAI,
  handleStopAIStream,
  handleImagePreview,
  handlePreviewImage,
  handlePreviewVideo,
  handleModelClick,
  handleModelPopoverShowChange,
  selectModel,
  handleModelPageChange,
  handleOpenModelManagement,
  handleSelectRole,
  handleOpenRoleManagement,
  handleBlur,
  handleEdit,
  handleCreateNewChat,
  handleDeleteMessage,
  handleDeleteChat,
  switchHistoryType,
  handleHistoryPageChange
} = useRobotChat({
  msgInputRef: MsgInputRef
})
</script>

<style scoped lang="scss">
@use '@/styles/scss/render-message';
@use '@/styles/scss/chatBot/code-block';

/* 主容器布局 */
.chat-main-container {
  display: flex;
  flex-direction: row;
  height: 100vh;
  overflow: hidden;
}

/* 右侧聊天区域 */
.chat-content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.paragraph-node) {
  margin: 0.5rem 0;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.history-item {
  border: 1px solid var(--hula-border-default);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.history-wrapper {
  display: flex;
  flex-direction: column;
}

.media-preview {
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  cursor: pointer;
  position: relative;

  .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .video-preview {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  .preview-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    &.error {
      background: #fff1f0;
    }
  }
}

.history-info {
  padding: 12px;

  .prompt {
    font-size: 13px;
    color: var(--hula-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}

.preview-container {
  .preview-image,
  .preview-video {
    width: 100%;
    max-height: 70vh;
    object-fit: contain;
    border-radius: 8px;
  }

  .preview-info {
    padding: 16px;
    background: var(--bg-color);
    border-radius: 8px;
  }
}
</style>
