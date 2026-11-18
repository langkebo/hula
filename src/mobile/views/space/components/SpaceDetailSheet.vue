<template>
  <van-action-sheet :show="show" :title="space?.name ?? ''" @update:show="emit('update:show', $event)">
    <div v-if="space" class="space-detail">
      <!-- 层级面包屑：此前详情层看不出自己处在哪一层，也无法一键回到上层（P-3） -->
      <nav class="detail-breadcrumb" :aria-label="t('space.hierarchy_title')">
        <button v-clickable type="button" class="breadcrumb-item" @click="emit('update:show', false)">
          {{ t('space.title') }}
        </button>
        <template v-for="node in ancestorPath" :key="node.spaceId">
          <van-icon name="arrow" class="breadcrumb-sep" aria-hidden="true" />
          <button v-clickable type="button" class="breadcrumb-item" @click="emit('switch-ancestor', node.spaceId)">
            {{ node.name || node.spaceId }}
          </button>
        </template>
        <van-icon name="arrow" class="breadcrumb-sep" aria-hidden="true" />
        <span class="breadcrumb-item breadcrumb-current" aria-current="page">{{ space.name }}</span>
      </nav>

      <div class="detail-header">
        <div
          v-clickable
          class="detail-cover"
          :class="{ 'detail-cover-editable': canManageSpace }"
          data-testid="space-avatar"
          @click="handleAvatarClick">
          <img v-if="space.avatarUrl" :src="space.avatarUrl" :alt="space.name" />
          <div v-else class="default-cover">
            <van-icon name="cluster-o" size="60" />
          </div>
          <span v-if="canManageSpace" class="cover-edit">
            <van-icon name="photograph" aria-hidden="true" />
          </span>
        </div>
        <div class="detail-info">
          <div class="detail-name">{{ space.name }}</div>
          <div v-if="space.topic" class="detail-topic">{{ space.topic }}</div>
          <div class="detail-stats">
            <span
              v-clickable
              class="detail-members-entry"
              data-testid="space-members-entry"
              @click="emit('open-members')">
              <van-icon name="friends-o" />
              {{ space.memberCount }} {{ t('space.members') }}
              <van-icon name="arrow" class="detail-members-arrow" />
            </span>
            <span>
              <van-icon name="chat-o" />
              {{ space.childCount }} {{ t('space.rooms') }}
            </span>
          </div>
        </div>
      </div>

      <SpaceChildrenList :space-id="space.spaceId" />

      <van-divider />

      <div class="detail-actions">
        <van-button block type="primary" @click="emit('invite')">
          <template #icon><van-icon name="add-o" /></template>
          {{ t('space.invite') }}
        </van-button>
        <van-button block @click="emit('add-room')">
          <template #icon><van-icon name="plus" /></template>
          {{ t('space.add_room') }}
        </van-button>
        <van-button block @click="emit('settings')">
          <template #icon><van-icon name="setting-o" /></template>
          {{ t('space.settings') }}
        </van-button>
      </div>

      <!-- 头像编辑：浏览器环境走 input，Tauri 环境走系统文件选择器（P-4） -->
      <input
        :ref="bindFileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        @change="handleFileChange" />
      <AvatarCropper :ref="bindCropper" v-model:show="showCropper" :image-url="localImageUrl" @crop="handleCrop" />
    </div>
  </van-action-sheet>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useAvatarUpload } from '@/composables/user/useAvatarUpload'
import type { SpaceInfo } from '@/services/matrix/room/MatrixSpaceService'
import SpaceChildrenList from './SpaceChildrenList.vue'

defineOptions({ name: 'SpaceDetailSheet' })

const props = defineProps<{
  show: boolean
  space: SpaceInfo | null
  ancestorPath: Array<{ spaceId: string; name: string }>
  canManageSpace: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'switch-ancestor': [spaceId: string]
  'open-members': []
  invite: []
  'add-room': []
  settings: []
  'avatar-updated': [mxcUrl: string]
}>()

const { t } = useI18n()

/**
 * 头像编辑只在本组件内闭环：文件选择 / 裁剪的 DOM ref 都挂在这里，
 * 上传成功后把 mxcUrl 交给父级写回房间头像并刷新列表。
 */
const { localImageUrl, showCropper, cropperRef, fileInput, openAvatarCropper, handleFileChange, handleCrop } =
  useAvatarUpload({
    onSuccess: (mxcUrl) => emit('avatar-updated', mxcUrl)
  })

/** 模板 ref 绑定：把 DOM / 组件实例写回 useAvatarUpload 内部的 ref */
const bindFileInput = (el: unknown) => {
  fileInput.value = (el as HTMLInputElement | null) ?? undefined
}
const bindCropper = (el: unknown) => {
  cropperRef.value = el
}

/** 头像区域点击：仅管理员可触发，避免普通成员误触后收到服务端拒绝 */
function handleAvatarClick() {
  if (!props.canManageSpace) return
  openAvatarCropper()
}
</script>

<style scoped lang="scss">
.space-detail {
  padding: 16px;

  .detail-breadcrumb {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--van-text-color-3);

    .breadcrumb-item {
      padding: 0;
      border: none;
      background: none;
      font: inherit;
      color: var(--van-text-color-3);
    }

    .breadcrumb-current {
      color: var(--van-text-color);
      font-weight: 500;
    }

    .breadcrumb-sep {
      font-size: 10px;
      color: var(--van-text-color-3);
    }
  }

  .detail-header {
    display: flex;
    gap: 16px;

    .detail-cover {
      position: relative;
      width: 100px;
      height: 100px;
      flex-shrink: 0;
      border-radius: 8px;
      overflow: hidden;
      background: var(--van-gray-2);
      display: flex;
      align-items: center;
      justify-content: center;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .default-cover {
        color: var(--van-gray-5);
      }

      .cover-edit {
        position: absolute;
        right: 4px;
        bottom: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        font-size: 12px;
        color: var(--tjg-text-inverse);
        background: var(--tjg-overlay-inverse-strong);
      }
    }

    .detail-info {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8px;

      .detail-name {
        font-size: 16px;
        font-weight: 500;
      }

      .detail-topic {
        font-size: 14px;
        color: var(--van-text-color-2);
      }

      .detail-stats {
        display: flex;
        gap: 16px;
        font-size: 14px;
        color: var(--tjg-text-tertiary);

        span {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .detail-members-entry {
          color: var(--tjg-text-secondary);
        }

        .detail-members-arrow {
          font-size: var(--tjg-font-size-sm);
          color: var(--tjg-text-tertiary);
        }
      }
    }
  }

  .detail-actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
