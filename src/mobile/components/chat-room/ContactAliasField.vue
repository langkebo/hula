<template>
  <!-- F-6：别名（对方看我的名字）。方向与「备注」相反，副标题必须说清 -->
  <div class="w-full flex flex-col gap-15px rounded-10px">
    <div class="ps-15px text-14px">
      <span class="dark:text-white">{{ t('mobile_chat_setting.alias') }}</span>
      <span class="text-[--tjg-text-secondary] ml-1">
        {{ t('mobile_chat_setting.alias_visible') }}
      </span>
    </div>
    <van-field
      :model-value="value"
      :placeholder="t('mobile_chat_setting.input.alias')"
      data-test="mobile-contact-alias"
      class="rounded-10px"
      @update:model-value="value = $event"
      @blur="handleBlur" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { applyAliasToDmRoom, clearAliasFromDmRoom } from '@/services/matrix/aliases/applyContactAlias'
import {
  contactAliasVersion,
  getContactAlias,
  removeContactAlias,
  saveContactAlias
} from '@/services/matrix/aliases/contactAliasRegistry'

/**
 * 移动端「对方看到的我」（F-6）。
 *
 * 从 `ChatSetting.vue` 整体抽出：该文件已超 800 行红线且不得增长
 * （`check:file-size` 对基线内文件零容忍），宿主只留一行挂载。
 *
 * 交互约定：blur 保存；**清空即清除**（回落账号昵称）。
 * 清除顺序必须先清房间级状态、再删本地记录 —— 反了会出现"本地已清、对方仍看我旧名字"。
 */
defineOptions({ name: 'ContactAliasField' })

const props = defineProps<{ userId: string }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const value = ref(getContactAlias(props.userId)?.displayName ?? '')
const saving = ref(false)

/** 别名是模块级缓存（不是 store），读版本号建立响应式依赖 */
watch(
  () => contactAliasVersion.value,
  () => {
    value.value = getContactAlias(props.userId)?.displayName ?? ''
  }
)

watch(
  () => props.userId,
  (uid) => {
    value.value = getContactAlias(uid)?.displayName ?? ''
  }
)

async function handleBlur(): Promise<void> {
  const uid = props.userId
  if (!uid || saving.value) return

  const next = value.value.trim()
  const current = getContactAlias(uid)?.displayName ?? ''
  if (next === current) return

  saving.value = true
  try {
    if (!next) {
      await clearAliasFromDmRoom(uid)
      await removeContactAlias(uid)
      value.value = ''
      showFeedback(t('mobile_chat_setting.alias_cleared'), 'success')
      return
    }

    await saveContactAlias(uid, { displayName: next })
    const applied = await applyAliasToDmRoom(uid)
    // 没有单聊房间时不能谎报"对方已看到"
    showFeedback(
      applied ? t('mobile_chat_setting.alias_saved') : t('mobile_chat_setting.alias_saved_pending'),
      'success'
    )
  } catch {
    showFeedback(t('mobile_chat_setting.alias_invalid'), 'error')
  } finally {
    saving.value = false
  }
}
</script>
