<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_notifications.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_notifications.global_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_notifications.enable_notifications')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:bell" :width="20" color="#1989fa" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="notificationsEnabled" @change="handleNotificationsToggle" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.enable_sound')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-green-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:volume-high" :width="20" color="#52c41a" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="soundEnabled" :disabled="!notificationsEnabled" @change="handleSoundToggle" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_notifications.highlight_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_notifications.highlight_words')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-orange-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:format-text-highlight" :width="20" color="#fa8c16" />
                </div>
              </template>
              <template #label>
                <div class="flex flex-wrap gap-8px mt-8px">
                  <van-tag
                    v-for="word in highlightWords"
                    :key="word"
                    closeable
                    type="primary"
                    plain
                    @close="handleRemoveWord(word)">
                    {{ word }}
                  </van-tag>
                  <van-tag
                    v-if="showAddWordInput"
                    type="primary"
                    class="add-word-tag">
                    <input
                      ref="addWordInputRef"
                      v-model="newWord"
                      class="add-word-input"
                      :placeholder="t('mobile_notifications.enter_word')"
                      @keyup.enter="handleAddWord"
                      @blur="handleAddWordBlur" />
                  </van-tag>
                  <van-tag
                    v-else
                    type="primary"
                    plain
                    @click="showAddWordInput = true">
                    + {{ t('mobile_notifications.add_word') }}
                  </van-tag>
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_notifications.room_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_notifications.all_messages')">
              <template #right-icon>
                <van-radio-group v-model="roomNotifyMode" direction="horizontal">
                  <van-radio name="all">{{ t('mobile_notifications.notify') }}</van-radio>
                  <van-radio name="mention">{{ t('mobile_notifications.mention_only') }}</van-radio>
                  <van-radio name="none">{{ t('mobile_notifications.mute') }}</van-radio>
                </van-radio-group>
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.group_messages')">
              <template #right-icon>
                <van-radio-group v-model="groupNotifyMode" direction="horizontal">
                  <van-radio name="all">{{ t('mobile_notifications.notify') }}</van-radio>
                  <van-radio name="mention">{{ t('mobile_notifications.mention_only') }}</van-radio>
                  <van-radio name="none">{{ t('mobile_notifications.mute') }}</van-radio>
                </van-radio-group>
              </template>
            </van-cell>

            <van-cell
              :title="t('mobile_notifications.room_rules')"
              is-link
              :value="roomRulesCount"
              @click="showRoomRules = true">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-purple-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:room-service" :width="20" color="#722ed1" />
                </div>
              </template>
            </van-cell>
          </van-cell-group>

          <div class="text-14px text-gray-500 mt-16px mb-8px">{{ t('mobile_notifications.advanced_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_notifications.desktop_notifications')">
              <template #right-icon>
                <van-switch v-model="desktopNotifications" :disabled="!notificationsEnabled" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.email_notifications')">
              <template #right-icon>
                <van-switch v-model="emailNotifications" :disabled="!notificationsEnabled" />
              </template>
            </van-cell>

            <van-cell :title="t('mobile_notifications.encrypted_rooms')">
              <template #right-icon>
                <van-switch v-model="encryptedRoomNotifications" :disabled="!notificationsEnabled" />
              </template>
            </van-cell>
          </van-cell-group>

          <div class="mt-16px px-16px">
            <van-button type="primary" block :loading="saving" @click="handleSave">
              {{ t('mobile_notifications.save') }}
            </van-button>
          </div>
        </div>
      </div>

      <van-popup
        v-model:show="showRoomRules"
        position="bottom"
        round
        :style="{ height: '60%' }">
        <div class="flex flex-col h-full">
          <div class="flex items-center justify-between p-16px border-b border-gray-100">
            <span class="text-16px font-medium">{{ t('mobile_notifications.room_rules_title') }}</span>
            <Icon icon="mdi:close" :width="24" @click="showRoomRules = false" />
          </div>

          <div class="flex-1 overflow-auto p-16px">
            <div v-if="loadingRoomRules" class="flex justify-center items-center py-40px">
              <van-loading size="24px" />
            </div>

            <div v-else-if="roomRules.length === 0" class="flex flex-col items-center justify-center py-40px">
              <Icon icon="mdi:bell-off" :width="48" color="#999" />
              <div class="text-14px text-gray-400 mt-16px">{{ t('mobile_notifications.no_room_rules') }}</div>
            </div>

            <van-cell-group v-else inset>
              <van-cell
                v-for="rule in roomRules"
                :key="rule.roomId"
                :title="getRoomName(rule.roomId)"
                :label="rule.roomId">
                <template #right-icon>
                  <van-dropdown-menu>
                    <van-dropdown-item
                      v-model="rule.ruleType"
                      :options="ruleTypeOptions"
                      @change="handleRoomRuleChange(rule)" />
                  </van-dropdown-menu>
                </template>
              </van-cell>
            </van-cell-group>
          </div>
        </div>
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, computed } from 'vue'
import { showToast } from 'vant'
import { Icon } from '@iconify/vue'
import { matrixPushService } from '@/services/matrix'
import type { IPushRule } from 'matrix-js-sdk'
import { PushRuleKind } from 'matrix-js-sdk'
import { matrixSettingsService, type RoomPushRule } from '@/services/matrix/MatrixSettingsService'
import matrixClientService from '@/services/matrix/MatrixClientService'
import { useI18n } from 'vue-i18n'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('NotificationSettings')

const { t } = useI18n()

const notificationsEnabled = ref(true)
const soundEnabled = ref(true)
const roomNotifyMode = ref('all')
const groupNotifyMode = ref('mention')
const desktopNotifications = ref(true)
const emailNotifications = ref(false)
const encryptedRoomNotifications = ref(true)
const saving = ref(false)

const highlightWords = ref<string[]>([])
const showAddWordInput = ref(false)
const newWord = ref('')
const addWordInputRef = ref<HTMLInputElement | null>(null)

const showRoomRules = ref(false)
const roomRules = ref<RoomPushRule[]>([])
const loadingRoomRules = ref(false)

const roomRulesCount = computed(() => {
  return roomRules.value.length > 0 ? `${roomRules.value.length}` : ''
})

const ruleTypeOptions = [
  { text: t('mobile_notifications.all_messages'), value: 'all_messages' },
  { text: t('mobile_notifications.mentions_only'), value: 'mentions_only' },
  { text: t('mobile_notifications.mute'), value: 'mute' }
]

onMounted(async () => {
  await Promise.all([loadPushRules(), loadHighlightWords(), loadRoomRules()])
})

function findAllRules(rules: {
  override?: IPushRule[]
  content?: IPushRule[]
  room?: IPushRule[]
  sender?: IPushRule[]
  underride?: IPushRule[]
}): IPushRule[] {
  return [
    ...(rules.override || []),
    ...(rules.content || []),
    ...(rules.room || []),
    ...(rules.sender || []),
    ...(rules.underride || [])
  ]
}

async function loadPushRules() {
  try {
    const rules = await matrixPushService.getRawPushRules()

    const allRules = findAllRules(rules?.global)

    const masterRule = allRules.find((r) => r.rule_id === '.m.rule.master')
    if (masterRule && !masterRule.enabled) {
      notificationsEnabled.value = true
    }

    const dmRule = allRules.find((r) => r.rule_id === '.m.rule.room_one_to_one')
    if (dmRule) {
      roomNotifyMode.value = dmRule.enabled ? 'all' : 'none'
    }

    const messageRule = allRules.find((r) => r.rule_id === '.m.rule.message')
    if (messageRule) {
      if (
        messageRule.actions?.some((a) => {
          return a === 'notify'
        })
      ) {
        groupNotifyMode.value = 'all'
      }
    }
  } catch (error) {
    logger.error('加载推送规则失败:', error)
  }
}

async function loadHighlightWords() {
  try {
    const words = await matrixSettingsService.getHighlightWords()
    highlightWords.value = words.filter((w) => w.enabled).map((w) => w.word)
  } catch (error) {
    logger.error('加载高亮关键词失败:', error)
  }
}

async function loadRoomRules() {
  loadingRoomRules.value = true
  try {
    roomRules.value = await matrixSettingsService.getRoomPushRules()
  } catch (error) {
    logger.error('加载房间规则失败:', error)
  } finally {
    loadingRoomRules.value = false
  }
}

async function handleNotificationsToggle(enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled(PushRuleKind.Override, '.m.rule.master', !enabled)
  } catch (error) {
    logger.error('设置通知开关失败:', error)
    notificationsEnabled.value = !enabled
  }
}

async function handleSoundToggle(enabled: boolean) {
  try {
    const actions = enabled ? ['notify'] : ['dont_notify']

    await matrixPushService.updatePushRuleActions(PushRuleKind.Underride, '.m.rule.room_one_to_one', actions)
    await matrixPushService.updatePushRuleActions(PushRuleKind.Underride, '.m.rule.message', actions)
  } catch (error) {
    logger.error('设置声音失败:', error)
    soundEnabled.value = !enabled
  }
}

async function handleAddWord() {
  if (!newWord.value.trim()) {
    showAddWordInput.value = false
    return
  }

  const word = newWord.value.trim()
  if (highlightWords.value.includes(word)) {
    showToast({
      type: 'fail',
      message: t('mobile_notifications.word_exists')
    })
    return
  }

  try {
    const success = await matrixSettingsService.addHighlightWord(word)
    if (success) {
      highlightWords.value.push(word)
      newWord.value = ''
      showAddWordInput.value = false
    }
  } catch (error) {
    logger.error('添加关键词失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_notifications.add_word_failed')
    })
  }
}

function handleAddWordBlur() {
  nextTick(() => {
    if (newWord.value.trim()) {
      handleAddWord()
    } else {
      showAddWordInput.value = false
    }
  })
}

async function handleRemoveWord(word: string) {
  try {
    const success = await matrixSettingsService.removeHighlightWord(word)
    if (success) {
      highlightWords.value = highlightWords.value.filter((w) => w !== word)
    }
  } catch (error) {
    logger.error('移除关键词失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_notifications.remove_word_failed')
    })
  }
}

function getRoomName(roomId: string): string {
  const room = matrixClientService.getRoom(roomId)
  return room?.name || roomId
}

async function handleRoomRuleChange(rule: RoomPushRule) {
  try {
    await matrixSettingsService.setRoomPushRule(rule.roomId, rule.ruleType)
    showToast({
      type: 'success',
      message: t('mobile_notifications.room_rule_updated')
    })
  } catch (error) {
    logger.error('更新房间规则失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_notifications.room_rule_failed')
    })
  }
}

async function handleSave() {
  saving.value = true
  try {
    const dmEnabled = roomNotifyMode.value !== 'none'
    const msgEnabled = groupNotifyMode.value !== 'none'

    await matrixPushService.setPushRuleEnabled(PushRuleKind.Underride, '.m.rule.room_one_to_one', dmEnabled)
    await matrixPushService.setPushRuleEnabled(PushRuleKind.Underride, '.m.rule.message', msgEnabled)

    showToast({
      type: 'success',
      message: t('mobile_notifications.save_success')
    })
  } catch (error) {
    logger.error('保存设置失败:', error)
    showToast({
      type: 'fail',
      message: t('mobile_notifications.save_failed')
    })
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.add-word-tag {
  padding: 2px 8px;
}

.add-word-input {
  width: 80px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
}
</style>
