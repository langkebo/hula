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

          <van-cell-group :title="t('mobile_push.devices_section')" inset>
            <van-cell
              v-for="pusher in pushers"
              :key="`${pusher.app_id}:${pusher.pushkey}`"
              :title="getPusherDisplayName(pusher, t('mobile_push.unknown_device'))"
              :label="getPusherSubtitle(pusher) || undefined"
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
              :label="rule.pattern || undefined"
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
      </div>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { showToast } from 'vant'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AutoFixHeightPage from '@/mobile/components/chat-room/AutoFixHeightPage.vue'
import HeaderBar from '@/mobile/components/chat-room/HeaderBar.vue'
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

const loading = ref(true)
const togglingMaster = ref(false)
const pushers = ref<IPusher[]>([])
const groupedRules = ref(groupPushRulesByKind(null))
const masterEnabled = ref(true)

const totalRules = computed(() => countPushRules(groupedRules.value))

/** 只渲染有规则的 kind，避免移动端出现大段空分组。 */
const visibleKinds = computed(() => PUSH_RULE_KINDS.filter((kind) => groupedRules.value[kind].length > 0))

onMounted(async () => {
  await Promise.all([loadPushers(), loadRules()])
  loading.value = false
})

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
