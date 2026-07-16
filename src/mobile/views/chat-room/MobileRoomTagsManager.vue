<template>
  <van-popup
    :show="visible"
    position="bottom"
    round
    closeable
    :style="{ height: '70%' }"
    @update:show="handleVisibleChange">
    <div class="mobile-room-tags">
      <div class="header">{{ t('room_tags.title') }}</div>

      <!-- 添加标签 -->
      <div class="add-row">
        <van-field
          v-model="inputValue"
          :placeholder="t('room_tags.add_placeholder')"
          :disabled="flow.updating.value"
          maxlength="32"
          class="add-input" />
        <van-button
          size="small"
          type="primary"
          :loading="flow.updating.value"
          @click="handleAdd">
          {{ t('room_tags.add') }}
        </van-button>
      </div>

      <!-- 推荐标签 -->
      <div class="section">
        <div class="section-label">{{ t('room_tags.suggested') }}</div>
        <div class="suggested-list">
          <van-tag
            v-for="suggestion in flow.SUGGESTED_TAGS"
            :key="suggestion"
            :type="flow.hasTag(suggestion) ? 'default' : 'primary'"
            size="medium"
            round
            plain
            :class="{ 'is-disabled': flow.updating.value || flow.hasTag(suggestion) }"
            @click="handleAddSuggested(suggestion)">
            {{ suggestion }}
          </van-tag>
        </div>
      </div>

      <div class="mx-15px border-b border-[--hula-border-default]"></div>

      <!-- 当前标签列表 -->
      <van-loading v-if="flow.loading.value" class="loading" />
      <template v-else>
        <div v-if="flow.hasTags.value" class="tag-list">
          <van-cell-group inset>
            <van-cell v-for="tag in flow.tags.value" :key="tag.name" :title="tag.name">
              <template #right-icon>
                <van-tag
                  type="danger"
                  size="medium"
                  round
                  plain
                  :class="{ 'is-disabled': flow.updating.value }"
                  @click="handleRemove(tag.name)">
                  {{ t('room_tags.remove') }}
              </van-tag>
              </template>
            </van-cell>
          </van-cell-group>
        </div>
        <van-empty v-else :description="t('room_tags.empty')" />
      </template>

      <div v-if="flow.errorMessage.value" class="error-text">
        {{ flow.errorMessage.value }}
      </div>

      <!-- 全部清除按钮 -->
      <div v-if="flow.hasTags.value" class="footer">
        <van-button
          block
          plain
          type="danger"
          :loading="flow.updating.value"
          @click="handleClearAll">
          {{ t('room_tags.clear_all') }}
        </van-button>
      </div>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { showConfirmDialog } from 'vant'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomTags } from '@/composables/room/useRoomTags'

const props = defineProps<{
  visible: boolean
  roomId: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'updated'): void
}>()

const { t } = useI18n()

const flow = useRoomTags({ roomId: props.roomId })

const inputValue = ref('')

const handleAdd = async () => {
  const name = inputValue.value
  if (!name.trim()) return
  const ok = await flow.addTag(name)
  if (ok) {
    inputValue.value = ''
    emit('updated')
  }
}

const handleAddSuggested = async (suggestion: string) => {
  if (flow.hasTag(suggestion)) return
  const ok = await flow.addTag(suggestion)
  if (ok) emit('updated')
}

const handleRemove = async (name: string) => {
  const ok = await flow.removeTag(name)
  if (ok) emit('updated')
}

const handleClearAll = async () => {
  try {
    await showConfirmDialog({
      title: t('room_tags.clear_all'),
      message: t('room_tags.clear_confirm')
    })
    const ok = await flow.clearAll()
    if (ok) emit('updated')
  } catch {
    // 用户取消
  }
}

const handleVisibleChange = (value: boolean) => {
  emit('update:visible', value)
}

watch(
  () => [props.visible, props.roomId] as const,
  ([visible, roomId]) => {
    if (visible && roomId) {
      flow.load()
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.mobile-room-tags {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px 0 0;
  overflow-y: auto;
}

.header {
  padding: 0 16px 12px;
  font-size: 16px;
  font-weight: 600;
  color: var(--hula-text-primary);
  border-bottom: 1px solid var(--hula-border-default);
}

.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
}

.add-input {
  flex: 1;
}

.section {
  padding: 8px 16px 12px;
}

.section-label {
  font-size: 12px;
  color: var(--hula-text-tertiary);
  margin-bottom: 8px;
}

.suggested-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 24px 0;
}

.tag-list {
  padding: 4px 0;
}

.error-text {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--hula-color-danger-500, #ee0a24);
}

.footer {
  padding: 16px;
  margin-top: auto;
}
</style>
