<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :is-official="false" :hidden-right="true" :room-name="t('mobile_push.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full p-16px gap-12px">
        <div v-if="loading" class="flex justify-center items-center py-40px">
          <van-loading size="24px">{{ t('mobile_push.loading') }}</van-loading>
        </div>

        <template v-else>
          <van-cell-group :title="t('mobile_push.master_section')" inset>
            <van-cell :title="t('mobile_push.master_switch')" :label="t('mobile_push.master_switch_hint')">
              <template #right-icon>
                <van-switch v-model="masterEnabled" :loading="togglingMaster" @change="handleMasterToggle" />
              </template>
            </van-cell>
          </van-cell-group>

          <van-cell-group :title="t('setting.push.dnd.title')" inset>
            <van-cell :title="t('setting.push.dnd.label')" :label="t('setting.push.dnd.desc')">
              <template #right-icon>
                <van-switch v-model="dndEnabled" data-testid="dnd-switch" @change="handleDndToggle" />
              </template>
            </van-cell>
            <template v-if="dndEnabled">
              <van-cell
                :title="t('setting.push.dnd.startTime')"
                :value="dndStartLabel"
                is-link
                data-testid="dnd-start"
                @click="openDndPicker('start')" />
              <van-cell
                :title="t('setting.push.dnd.endTime')"
                :value="dndEndLabel"
                is-link
                data-testid="dnd-end"
                @click="openDndPicker('end')" />
            </template>
          </van-cell-group>

          <van-cell-group inset>
            <van-cell
              :title="t('setting.push.history.title')"
              :label="t('setting.push.history.desc')"
              is-link
              data-testid="notification-history-entry"
              @click="router.push(MOBILE_SETTINGS_NOTIFICATION_HISTORY_PATH)">
              <template #icon>
                <SettingCellIcon icon="mdi:history" color="var(--tjg-color-info-500)" shell="info" />
              </template>
            </van-cell>
          </van-cell-group>

          <van-cell-group :title="t('mobile_push.devices_section')" inset>
            <van-cell
              v-for="pusher in pushers"
              :key="`${pusher.app_id}:${pusher.pushkey}`"
              :title="getPusherDisplayName(pusher, t('mobile_push.unknown_device'))"
              v-bind="getPusherSubtitle(pusher) ? { label: getPusherSubtitle(pusher) } : {}"
              data-testid="push-device">
              <template #value>
                <span class="text-12px text-[--tjg-text-tertiary]" data-testid="push-device-key">
                  {{ maskPushKey(pusher.pushkey) }}
                </span>
              </template>
              <template #right-icon>
                <span
                  class="ml-8px text-12px"
                  :class="isPusherEnabled(pusher) ? 'text-[--tjg-color-success-500]' : 'text-[--tjg-text-tertiary]'"
                  data-testid="push-device-state">
                  {{ isPusherEnabled(pusher) ? t('mobile_push.device_enabled') : t('mobile_push.device_disabled') }}
                </span>
              </template>
            </van-cell>

            <van-cell v-if="pushers.length === 0" data-testid="push-empty" :title="t('mobile_push.no_devices')" />
          </van-cell-group>

          <van-cell-group v-for="kind in visibleKinds" :key="kind" :title="t(`mobile_push.kinds.${kind}`)" inset>
            <van-cell
              v-for="rule in groupedRules[kind]"
              :key="rule.rule_id"
              :title="formatPushRuleId(rule.rule_id)"
              v-bind="rule.pattern ? { label: rule.pattern } : {}"
              data-testid="push-rule">
              <template #right-icon>
                <van-switch
                  :model-value="isPushRuleEnabled(rule)"
                  size="22px"
                  @update:model-value="(value: boolean) => handleRuleToggle(kind, rule, value)" />
              </template>
            </van-cell>
          </van-cell-group>

          <div v-if="totalRules === 0" class="text-center text-13px text-[--tjg-text-tertiary] py-20px">
            {{ t('mobile_push.no_rules') }}
          </div>
        </template>

        <van-popup v-model:show="showDndPicker" position="bottom" round teleport="body">
          <van-time-picker
            v-model="dndPickerValue"
            :title="dndPickerTarget === 'start' ? t('setting.push.dnd.startTime') : t('setting.push.dnd.endTime')"
            @confirm="onDndPickerConfirm"
            @cancel="showDndPicker = false" />
        </van-popup>
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import dayjs from 'dayjs'
import { showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
import SettingCellIcon from '@/mobile/components/my/SettingCellIcon.vue'
import { MOBILE_SETTINGS_NOTIFICATION_HISTORY_PATH } from '@/mobile/views/my/settingsRoutes'
import { matrixNotificationService } from '@/services/matrix/notifications/MatrixNotificationService'
import type { IPusher, IPushRule } from '@/services/matrix/notifications/MatrixPushService'
import { matrixPushService } from '@/services/matrix/notifications/MatrixPushService'
import {
  countPushRules,
  formatPushRuleId,
  getPusherDisplayName,
  getPusherSubtitle,
  groupPushRulesByKind,
  isPusherEnabled,
  isPushRuleEnabled,
  maskPushKey,
  PUSH_RULE_KINDS,
  type PushRuleKindName
} from '@/services/matrix/notifications/pushSettingsPresentation'
import { createLogger } from '@/utils/Logger'

const logger = createLogger('MobilePushSettings')

const { t } = useI18n()
const router = useRouter()

const loading = ref(true)
const togglingMaster = ref(false)
const pushers = ref<IPusher[]>([])
const groupedRules = ref(groupPushRulesByKind(null))
const masterEnabled = ref(true)

const totalRules = computed(() => countPushRules(groupedRules.value))

/** 只渲染有规则的 kind，避免移动端出现大段空分组。 */
const visibleKinds = computed(() => PUSH_RULE_KINDS.filter((kind) => groupedRules.value[kind].length > 0))

onMounted(async () => {
  loadDnd()
  await Promise.all([loadPushers(), loadRules()])
  loading.value = false
})

// ── 免打扰时段（DND）────────────────────────────────────────
// 服务侧唯一写入点：`matrixNotificationService.setDndSettings` 负责打 updatedAt
// 并同步到账号数据，移动端只负责收集窗口。
const dndEnabled = ref(false)
const dndStartTime = ref<number | null>(null)
const dndEndTime = ref<number | null>(null)
const showDndPicker = ref(false)
const dndPickerTarget = ref<'start' | 'end'>('start')
const dndPickerValue = ref<string[]>(['22', '00'])

const dndStartLabel = computed(() => (dndStartTime.value ? dayjs(dndStartTime.value).format('HH:mm') : '--:--'))
const dndEndLabel = computed(() => (dndEndTime.value ? dayjs(dndEndTime.value).format('HH:mm') : '--:--'))

function loadDnd() {
  const window = matrixNotificationService.getDndSettings()
  dndEnabled.value = window.enabled
  dndStartTime.value = window.startTime
  dndEndTime.value = window.endTime
}

function persistDnd() {
  matrixNotificationService.setDndSettings({
    enabled: dndEnabled.value,
    startTime: dndStartTime.value,
    endTime: dndEndTime.value
  })
}

const DND_DEFAULT_START = ['22', '00']
const DND_DEFAULT_END = ['08', '00']

/** `['HH','mm']` → 今天的对应时间戳（服务侧按当天分钟数比较，日期无意义） */
function timeOfDay(values: string[]): number {
  return dayjs().hour(Number(values[0])).minute(Number(values[1])).second(0).millisecond(0).valueOf()
}

function handleDndToggle(enabled: boolean) {
  dndEnabled.value = enabled
  if (enabled) {
    // 关键：`isWithinDndWindow` 对「配置不完整」（start/end 任一为 null）返回 false，
    // 也就是开关打开了但**实际不会静音** —— 用户以为静音了，消息照响。
    // 所以打开即补默认窗口（22:00 → 08:00），保证开关状态与真实行为一致。
    if (dndStartTime.value === null) dndStartTime.value = timeOfDay(DND_DEFAULT_START)
    if (dndEndTime.value === null) dndEndTime.value = timeOfDay(DND_DEFAULT_END)
  }
  persistDnd()
}

function openDndPicker(target: 'start' | 'end') {
  dndPickerTarget.value = target
  const current = target === 'start' ? dndStartTime.value : dndEndTime.value
  dndPickerValue.value = current
    ? [dayjs(current).format('HH'), dayjs(current).format('mm')]
    : target === 'start'
      ? [...DND_DEFAULT_START]
      : [...DND_DEFAULT_END]
  showDndPicker.value = true
}

function onDndPickerConfirm({ selectedValues }: { selectedValues: string[] }) {
  const timestamp = timeOfDay(selectedValues)
  if (dndPickerTarget.value === 'start') {
    dndStartTime.value = timestamp
  } else {
    dndEndTime.value = timestamp
  }
  showDndPicker.value = false
  persistDnd()
}

async function loadPushers() {
  try {
    const list = await matrixPushService.getPushers()
    pushers.value = list.filter((pusher) => Boolean(pusher.pushkey))
  } catch (error) {
    logger.error('Failed to load pushers', error)
    showToast({ type: 'fail', message: t('mobile_push.load_failed') })
  }
}

async function loadRules() {
  try {
    const rules = await matrixPushService.getPushRules()
    groupedRules.value = groupPushRulesByKind(rules)
    const master = groupedRules.value.override.find((rule: IPushRule) => rule.rule_id === '.m.rule.master')
    masterEnabled.value = isPushRuleEnabled(master ?? { enabled: true })
  } catch (error) {
    logger.error('Failed to load push rules', error)
    showToast({ type: 'fail', message: t('mobile_push.load_failed') })
  }
}

async function handleMasterToggle(enabled: boolean) {
  togglingMaster.value = true
  try {
    await matrixPushService.setMasterRuleEnabled(enabled)
  } catch (error) {
    logger.error('Failed to toggle master push rule', error)
    masterEnabled.value = !enabled
    showToast({ type: 'fail', message: t('mobile_push.save_failed') })
  } finally {
    togglingMaster.value = false
  }
}

async function handleRuleToggle(kind: PushRuleKindName, rule: IPushRule, enabled: boolean) {
  try {
    await matrixPushService.setPushRuleEnabled('global', kind, rule.rule_id, enabled)
    rule.enabled = enabled
  } catch (error) {
    logger.error('Failed to toggle push rule', error)
    showToast({ type: 'fail', message: t('mobile_push.save_failed') })
  }
}
</script>
