<template>
  <AutoFixHeightPage :show-footer="false">
    <template #header>
      <HeaderBar border :isOfficial="false" :hidden-right="true" :room-name="t('mobile_burn.title')" />
    </template>

    <template #container>
      <div class="flex flex-col overflow-auto h-full">
        <div class="flex flex-col p-16px gap-12px">
          <div class="text-14px text-gray-500 mb-8px">{{ t('mobile_burn.global_section') }}</div>

          <van-cell-group inset>
            <van-cell :title="t('mobile_burn.global_enable')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-orange-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:timer-outline" :width="20" color="#fa8c16" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="globalEnabled" size="22px" @change="handleGlobalToggle" />
              </template>
            </van-cell>

            <van-cell
              v-if="globalEnabled"
              :title="t('mobile_burn.default_duration')"
              :value="currentDurationLabel"
              is-link
              @click="showDurationPicker = true">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-blue-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:clock-outline" :width="20" color="#1890ff" />
                </div>
              </template>
            </van-cell>

            <van-cell v-if="globalEnabled" :title="t('mobile_burn.show_countdown')">
              <template #icon>
                <div class="w-40px h-40px rounded-full bg-green-50 mr-12px flex items-center justify-center">
                  <Icon icon="mdi:countdown" :width="20" color="#52c41a" />
                </div>
              </template>
              <template #right-icon>
                <van-switch v-model="showCountdown" size="22px" @change="handleCountdownToggle" />
              </template>
            </van-cell>
          </van-cell-group>

          <div v-if="globalEnabled" class="text-14px text-gray-500 mt-16px mb-8px">
            {{ t('mobile_burn.room_section') }}
          </div>

          <van-cell-group v-if="globalEnabled" inset>
            <div v-if="loadingRooms" class="flex justify-center py-20px">
              <van-loading size="24px" />
            </div>
            <template v-else-if="burnRooms.length > 0">
              <van-cell
                v-for="room in burnRooms"
                :key="room.roomId"
                :title="room.name || room.roomId"
                :label="formatDuration(room.duration)">
                <template #icon>
                  <div class="w-40px h-40px rounded-full bg-red-50 mr-12px flex items-center justify-center">
                    <Icon icon="mdi:fire" :width="20" color="#ff4d4f" />
                  </div>
                </template>
                <template #right-icon>
                  <van-switch
                    :model-value="room.enabled"
                    size="22px"
                    @change="(val: boolean) => handleRoomToggle(room, val)" />
                </template>
              </van-cell>
            </template>
            <van-cell v-else :title="t('mobile_burn.no_rooms')" />
          </van-cell-group>

          <div v-if="globalEnabled" class="text-14px text-gray-500 mt-16px mb-8px">
            {{ t('mobile_burn.stats_section') }}
          </div>

          <van-cell-group v-if="globalEnabled" inset>
            <van-cell :title="t('mobile_burn.total_burned')" :value="burnStats.totalBurned.toString()" />
            <van-cell :title="t('mobile_burn.active_rooms')" :value="burnStats.activeRooms.toString()" />
          </van-cell-group>

          <div v-if="globalEnabled" class="flex items-start gap-8px p-12px bg-orange-50 rounded-8px mt-8px">
            <Icon icon="mdi:alert-circle" :width="16" color="#fa8c16" class="flex-shrink-0 mt-2px" />
            <span class="text-12px text-orange-700">{{ t('mobile_burn.warning') }}</span>
          </div>
        </div>
      </div>

      <van-popup v-model:show="showDurationPicker" position="bottom" round>
        <van-picker :columns="durationColumns" @confirm="handleDurationConfirm" @cancel="showDurationPicker = false" />
      </van-popup>
    </template>
  </AutoFixHeightPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Icon } from '@iconify/vue'
import { showToast } from 'vant'
import { useSettingStore } from '@/stores/domains/settings/setting'

const { t } = useI18n()
const settingStore = useSettingStore()

settingStore.migrateLegacyPreferenceSettings()

const globalEnabled = ref(settingStore.burnDefaultEnabled)
const defaultDuration = ref(settingStore.burnDefaultDuration)
const showCountdown = ref(settingStore.burnShowCountdownEnabled)
const showDurationPicker = ref(false)
const loadingRooms = ref(false)

const burnRooms = ref<{ roomId: string; name: string; duration: number; enabled: boolean }[]>([])

const burnStats = ref({ totalBurned: 0, activeRooms: 0 })

function formatDuration(seconds: number): string {
  if (seconds < 60) return t('setting.burn_after_read.formats.seconds', { count: String(seconds) })
  if (seconds < 3600) return t('setting.burn_after_read.formats.minutes', { count: String(seconds / 60) })
  if (seconds < 86400) return t('setting.burn_after_read.formats.hours', { count: String(seconds / 3600) })
  return t('setting.burn_after_read.formats.days', { count: String(seconds / 86400) })
}

const durationOptions = computed(() => [
  { label: formatDuration(30), value: 30 },
  { label: formatDuration(60), value: 60 },
  { label: formatDuration(300), value: 300 },
  { label: formatDuration(3600), value: 3600 },
  { label: formatDuration(86400), value: 86400 }
])

const durationColumns = computed(() => durationOptions.value.map((o) => ({ text: o.label, value: o.value })))

const currentDurationLabel = computed(() => {
  return durationOptions.value.find((o) => o.value === defaultDuration.value)?.label || formatDuration(60)
})

onMounted(() => {
  loadBurnRooms()
  loadBurnStats()
})

function loadBurnRooms() {
  loadingRooms.value = true
  try {
    const saved = localStorage.getItem('hula-burn-rooms')
    if (saved) {
      burnRooms.value = JSON.parse(saved)
    }
  } catch {
    // ignore
  } finally {
    loadingRooms.value = false
  }
}

function loadBurnStats() {
  try {
    const saved = localStorage.getItem('hula-burn-stats')
    if (saved) {
      burnStats.value = JSON.parse(saved)
    }
  } catch {
    // ignore
  }
}

function saveBurnRooms() {
  localStorage.setItem('hula-burn-rooms', JSON.stringify(burnRooms.value))
}

function handleGlobalToggle(val: boolean) {
  settingStore.setBurnDefaultEnabled(val)
  showToast(val ? t('mobile_burn.enabled') : t('mobile_burn.disabled'))
}

function handleCountdownToggle(val: boolean) {
  settingStore.setBurnShowCountdownEnabled(val)
}

function handleDurationConfirm({ selectedValues }: { selectedValues: number[] }) {
  const val = selectedValues[0] as 30 | 60 | 300 | 3600 | 86400
  if (val) {
    defaultDuration.value = val
    settingStore.setBurnDefaultDuration(val)
  }
  showDurationPicker.value = false
}

function handleRoomToggle(room: { roomId: string; name: string; duration: number; enabled: boolean }, val: boolean) {
  room.enabled = val
  saveBurnRooms()
  showToast(val ? t('mobile_burn.room_enabled') : t('mobile_burn.room_disabled'))
}
</script>
