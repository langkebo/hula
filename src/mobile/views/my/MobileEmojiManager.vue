<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('emoticon.packs.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-[--tjg-text-secondary]">{{ t('emoticon.packs.description') }}</div>

          <div v-if="loading" class="flex justify-center py-20px">
            <van-loading size="24px" />
          </div>

          <van-empty v-else-if="packs.length === 0" :description="t('emoticon.packs.empty')" />

          <van-cell-group v-else inset>
            <van-swipe-cell v-for="pack in packs" :key="pack.id">
              <van-cell is-link @click="openDetail(pack)">
                <template #icon>
                  <div
                    class="w-40px h-40px rounded-full mr-12px flex items-center justify-center overflow-hidden"
                    :style="iconShellStyles.pack">
                    <img v-if="pack.iconUrl" :src="pack.iconUrl" class="w-full h-full object-cover" />
                    <Icon v-else icon="mdi:emoticon" :width="20" color="var(--tjg-color-beta-500)" />
                  </div>
                </template>
                <template #title>
                  <span class="text-14px">{{ pack.name }}</span>
                </template>
                <template #value>
                  <span class="text-12px text-[--tjg-text-secondary]">
                    {{ t('emoticon.packs.pack_count', { count: pack.items.length }) }}
                  </span>
                </template>
              </van-cell>
              <template #right>
                <van-button square type="primary" :text="t('emoticon.packs.rename')" @click="openRename(pack)" />
                <van-button square type="danger" :text="t('emoticon.packs.uninstall')" @click="handleDelete(pack)" />
              </template>
            </van-swipe-cell>
          </van-cell-group>

          <van-button type="primary" block :loading="creating" @click="openCreate">
            <Icon icon="mdi:plus" :width="16" class="mr-4px" />
            {{ t('emoticon.packs.create') }}
          </van-button>
        </div>
      </div>

      <!-- 创建 / 重命名 表单 -->
      <van-popup v-model:show="showFormPopup" position="bottom" round :style="{ height: '28%' }">
        <div class="flex flex-col gap-16px p-16px">
          <div class="text-16px font-500">{{ formTitle }}</div>
          <van-field
            v-model="formName"
            :label="t('emoticon.packs.pack_name')"
            :placeholder="t('emoticon.packs.pack_name_placeholder')"
            clearable
            maxlength="30" />
          <div class="flex gap-12px">
            <van-button block @click="showFormPopup = false">{{ t('common.cancel') }}</van-button>
            <van-button type="primary" block :disabled="!formName.trim()" @click="submitForm">
              {{ t('common.confirm') }}
            </van-button>
          </div>
        </div>
      </van-popup>

      <!-- 表情包详情 -->
      <van-popup v-model:show="showDetailPopup" position="bottom" round :style="{ height: '70%' }">
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between px-16px py-12px border-b border-[--tjg-border-layout-divider]">
            <span class="text-16px font-500">{{ detailPack?.name }}</span>
            <span class="text-12px text-[--tjg-text-secondary]">
              {{ t('emoticon.packs.pack_count', { count: detailPack?.items.length ?? 0 }) }}
            </span>
          </div>

          <div class="flex-1 overflow-auto p-12px">
            <van-empty v-if="!detailPack || detailPack.items.length === 0" :description="t('emoticon.packs.empty')" />

            <div v-else class="grid grid-cols-4 gap-8px">
              <div v-for="emoji in detailPack.items" :key="emoji.id" class="relative">
                <van-swipe-cell>
                  <div
                    class="aspect-square flex items-center justify-center bg-[--tjg-surface-panel] rounded-8px overflow-hidden">
                    <img
                      :src="emoji.url"
                      :alt="emoji.name"
                      loading="lazy"
                      decoding="async"
                      class="w-full h-full object-cover" />
                  </div>
                  <template #right>
                    <van-button
                      square
                      type="danger"
                      :text="t('emoticon.packs.remove_emoji')"
                      @click="handleRemoveEmoji(emoji.id)" />
                  </template>
                </van-swipe-cell>
                <div class="text-center text-10px text-[--tjg-text-secondary] mt-4px truncate">{{ emoji.name }}</div>
              </div>
            </div>
          </div>

          <div class="p-12px border-t border-[--tjg-border-layout-divider]">
            <van-uploader
              :after-read="handleAfterRead"
              :preview-image="false"
              :max-count="1"
              accept="image/png,image/gif,image/webp">
              <van-button plain type="primary" block>
                <Icon icon="mdi:upload" :width="16" class="mr-4px" />
                {{ t('emoticon.packs.add_emoji') }}
              </van-button>
            </van-uploader>
          </div>
        </div>
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { showConfirmDialog, type UploaderFileListItem } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEmojiPackManager } from '@/composables/emoji/useEmojiPackManager'
import type { EmojiPack } from '@/services/matrix/messaging/MatrixEmojiService'

const { t } = useI18n()

const { packs, loading, creating, load, createPack, deletePack, renamePack, addEmoji, removeEmoji } =
  useEmojiPackManager()

const iconShellStyles = {
  pack: { backgroundColor: 'var(--tjg-color-beta-100)' }
} as const

// 创建 / 重命名 表单
type FormMode = 'create' | 'rename'
const formMode = ref<FormMode>('create')
const showFormPopup = ref(false)
const formName = ref('')
const editingPackId = ref<string | null>(null)

const formTitle = computed(() =>
  formMode.value === 'create' ? t('emoticon.packs.create') : t('emoticon.packs.rename')
)

function openCreate() {
  formMode.value = 'create'
  formName.value = ''
  editingPackId.value = null
  showFormPopup.value = true
}

function openRename(pack: EmojiPack) {
  formMode.value = 'rename'
  formName.value = pack.name
  editingPackId.value = pack.id
  showFormPopup.value = true
}

async function submitForm() {
  const name = formName.value.trim()
  if (!name) return

  showFormPopup.value = false

  if (formMode.value === 'create') {
    await createPack(name)
  } else if (editingPackId.value) {
    await renamePack(editingPackId.value, name)
  }
}

// 删除表情包
async function handleDelete(pack: EmojiPack) {
  try {
    await showConfirmDialog({
      title: t('emoticon.packs.uninstall'),
      message: t('emoticon.packs.confirm_uninstall')
    })
  } catch {
    return
  }

  await deletePack(pack.id)
}

// 表情包详情
const showDetailPopup = ref(false)
const detailPack = ref<EmojiPack | null>(null)

function openDetail(pack: EmojiPack) {
  detailPack.value = pack
  showDetailPopup.value = true
}

// 上传表情
async function handleAfterRead(fileList: UploaderFileListItem | UploaderFileListItem[]) {
  const packId = detailPack.value?.id
  if (!packId) return

  const items = Array.isArray(fileList) ? fileList : [fileList]
  const file = items[0]?.file
  if (!file) return

  const name = file.name.replace(/\.[^.]+$/, '') || 'emoji'
  await addEmoji(packId, { file, name })

  // composable 内部已重新加载列表,这里同步详情视图
  detailPack.value = packs.value.find((p) => p.id === packId) ?? null
}

// 移除表情
async function handleRemoveEmoji(emojiId: string) {
  const packId = detailPack.value?.id
  if (!packId) return

  await removeEmoji(packId, emojiId)

  // composable 内部已重新加载列表,这里同步详情视图
  detailPack.value = packs.value.find((p) => p.id === packId) ?? null
}

onMounted(() => {
  load()
})
</script>

<style scoped lang="scss">
:deep(.van-cell-group--inset) {
  margin: 0 12px;
  border-radius: 12px;
  overflow: hidden;
}

:deep(.van-cell) {
  background: var(--tjg-surface-panel);
}

:deep(.van-cell::after) {
  border-bottom: 1px solid var(--tjg-border-layout-divider);
}

:deep(.van-swipe-cell__right .van-button) {
  height: 100%;
}
</style>
