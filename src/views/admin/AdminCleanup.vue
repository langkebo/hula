<template>
  <div class="admin-cleanup">
    <n-alert :bordered="false" type="warning">{{ t('admin.cleanup.hint') }}</n-alert>

    <n-alert v-if="error" data-testid="admin-cleanup-error" class="mt-16px" type="error" closable @close="error = null">
      {{ error }}
    </n-alert>

    <n-card :title="t('admin.cleanup.optionsTitle')" class="mt-16px">
      <n-space align="center" :wrap="true">
        <n-input-number
          v-model:value="minAgeMs"
          data-testid="admin-cleanup-min-age"
          :min="0"
          :placeholder="t('admin.cleanup.minAgePlaceholder')"
          class="w-[240px]" />
        <span class="option-hint">{{ t('admin.cleanup.minAgeHint') }}</span>
      </n-space>
    </n-card>

    <n-card :title="t('admin.cleanup.all.title')" class="mt-16px">
      <n-space vertical>
        <span class="action-desc">{{ t('admin.cleanup.all.description') }}</span>
        <n-space>
          <n-button data-testid="admin-cleanup-run-all" type="error" :loading="running" @click="confirmRun('all')">
            {{ t('admin.cleanup.all.action') }}
          </n-button>
        </n-space>
      </n-space>
    </n-card>

    <n-card :title="t('admin.cleanup.rooms.title')" class="mt-16px">
      <n-space vertical>
        <span class="action-desc">{{ t('admin.cleanup.rooms.description') }}</span>
        <n-space>
          <n-button
            data-testid="admin-cleanup-run-rooms"
            type="warning"
            :loading="running"
            @click="confirmRun('rooms')">
            {{ t('admin.cleanup.rooms.action') }}
          </n-button>
        </n-space>
      </n-space>
    </n-card>

    <n-card :title="t('admin.cleanup.tokens.title')" class="mt-16px">
      <n-space vertical>
        <span class="action-desc">{{ t('admin.cleanup.tokens.description') }}</span>
        <n-space>
          <n-button
            data-testid="admin-cleanup-run-tokens"
            type="warning"
            :loading="running"
            @click="confirmRun('tokens')">
            {{ t('admin.cleanup.tokens.action') }}
          </n-button>
        </n-space>
      </n-space>
    </n-card>

    <n-card v-if="outcome" data-testid="admin-cleanup-result" :title="t('admin.cleanup.resultTitle')" class="mt-16px">
      <n-descriptions v-if="outcome.kind === 'all'" :column="2" bordered size="small" label-placement="left">
        <n-descriptions-item :label="t('admin.cleanup.result.emptyRooms')">
          {{ outcome.result.rooms.deleted_empty_rooms }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.cleanup.result.eventsInEmptyRooms')">
          {{ outcome.result.rooms.deleted_events_in_empty_rooms }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.cleanup.result.accessTokens')">
          {{ outcome.result.tokens.access_tokens_deleted }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.cleanup.result.refreshTokens')">
          {{ outcome.result.tokens.refresh_tokens_deleted }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.cleanup.result.registrationTokens')">
          {{ outcome.result.tokens.registration_tokens_deleted }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.cleanup.result.emailTokens')">
          {{ outcome.result.tokens.email_tokens_deleted }}
        </n-descriptions-item>
      </n-descriptions>

      <n-descriptions v-else-if="outcome.kind === 'rooms'" :column="2" bordered size="small" label-placement="left">
        <n-descriptions-item :label="t('admin.cleanup.result.emptyRooms')">
          {{ outcome.result.deleted_empty_rooms }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.cleanup.result.eventsInEmptyRooms')">
          {{ outcome.result.deleted_events_in_empty_rooms }}
        </n-descriptions-item>
      </n-descriptions>

      <n-descriptions v-else :column="2" bordered size="small" label-placement="left">
        <n-descriptions-item :label="t('admin.cleanup.result.accessTokens')">
          {{ outcome.result.access_tokens_deleted }}
        </n-descriptions-item>
        <n-descriptions-item :label="t('admin.cleanup.result.refreshTokens')">
          {{ outcome.result.refresh_tokens_deleted }}
        </n-descriptions-item>
      </n-descriptions>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NAlert, NButton, NCard, NDescriptions, NDescriptionsItem, NInputNumber, NSpace, useDialog } from 'naive-ui'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { type CleanupKind, useAdminCleanup } from '@/composables/admin'
import { useActionFeedback } from '@/composables/common/useActionFeedback'

defineOptions({ name: 'AdminCleanup' })

const { t } = useI18n()
const { showFeedback } = useActionFeedback()
const dialog = useDialog()

const { running, error, outcome, runCleanupAll, runCleanupRooms, runCleanupTokens } = useAdminCleanup()

const minAgeMs = ref<number | null>(null)

async function execute(kind: CleanupKind): Promise<void> {
  const age = minAgeMs.value ?? undefined
  const ok =
    kind === 'all' ? await runCleanupAll(age) : kind === 'rooms' ? await runCleanupRooms(age) : await runCleanupTokens()
  showFeedback(ok ? t(`admin.cleanup.${kind}.success`) : t(`admin.cleanup.${kind}.failed`), ok ? 'success' : 'error')
}

function confirmRun(kind: CleanupKind): void {
  dialog.error({
    title: t(`admin.cleanup.${kind}.confirmTitle`),
    content: t(`admin.cleanup.${kind}.confirmContent`),
    positiveText: t('admin.common.confirm'),
    negativeText: t('admin.common.cancel'),
    onPositiveClick: async () => {
      await execute(kind)
    }
  })
}
</script>

<style scoped>
@use '@/styles/scss/global/responsive.scss' as responsive;

.admin-cleanup {
  max-width: 1200px;
}

.mt-16px {
  margin-top: 16px;
}

.action-desc {
  font-size: 13px;
  color: var(--tjg-text-secondary);
}

.option-hint {
  font-size: 12px;
  color: var(--tjg-text-tertiary);
}

@media (prefers-reduced-motion: reduce) {
  .admin-cleanup {
    transition: none;
  }
}

@include responsive.down('md') {
  .action-desc {
    line-height: 1.6;
  }
}
</style>
