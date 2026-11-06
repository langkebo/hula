<template>
  <n-tab-pane name="statistics" :tab="t('admin.users.statistics')">
    <n-spin :show="loading">
      <template v-if="stats">
        <n-space :size="24" class="py-16px">
          <n-statistic :label="t('admin.users.roomsJoined')" :value="toStat(stats.joined_rooms ?? stats.joinedRooms)" />
          <n-statistic
            :label="t('admin.users.messagesSent')"
            :value="toStat(stats.messages_sent ?? stats.messagesSent)" />
          <n-statistic
            :label="t('admin.users.mediaUploaded')"
            :value="toStat(stats.media_uploaded ?? stats.mediaUploaded)" />
          <n-statistic :label="t('admin.users.invitesSent')" :value="toStat(stats.invites_sent ?? stats.invitesSent)" />
        </n-space>
        <n-descriptions v-if="hasExtraStats" bordered :column="2" label-placement="left" size="small">
          <n-descriptions-item v-for="(value, key) in extraStats" :key="String(key)" :label="String(key)">
            {{ value }}
          </n-descriptions-item>
        </n-descriptions>
      </template>
      <n-empty v-else :description="t('admin.users.noStats')" class="py-24px" />
    </n-spin>
  </n-tab-pane>
</template>

<script setup lang="ts">
import { NDescriptions, NDescriptionsItem, NEmpty, NSpace, NSpin, NStatistic, NTabPane } from 'naive-ui'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  stats: Record<string, unknown> | null
  loading: boolean
}>()

const { t } = useI18n()

// Stats computed - extract known keys and show the rest
const knownStatKeys = new Set([
  'joined_rooms',
  'joinedRooms',
  'messages_sent',
  'messagesSent',
  'media_uploaded',
  'mediaUploaded',
  'invites_sent',
  'invitesSent'
])

const extraStats = computed(() => {
  if (!props.stats) return {}
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props.stats)) {
    if (!knownStatKeys.has(key)) {
      result[key] = value
    }
  }
  return result
})

const hasExtraStats = computed(() => Object.keys(extraStats.value).length > 0)

const toStat = (value: unknown): string | number =>
  typeof value === 'string' || typeof value === 'number' ? value : '-'
</script>
