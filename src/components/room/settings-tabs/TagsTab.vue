<template>
  <div class="rs-tab" data-testid="tags-tab">
    <!-- Hint text -->
    <p class="rs-tab__hint">{{ t('room.settings_drawer.tags_hint') }}</p>

    <n-spin :show="flow.loading.value">
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_tags') }}</h4>

        <!-- Add tag input -->
        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.section_tag_filter') }}</label>
          <div class="rs-tab__add-row">
            <n-input
              v-model:value="inputValue"
              :placeholder="t('room.settings_drawer.field_tag_input')"
              :maxlength="32"
              :disabled="flow.updating.value"
              @keydown.enter="handleAdd" />
            <n-button type="primary" :loading="flow.updating.value" :disabled="!inputValue.trim()" @click="handleAdd">
              <template #icon>
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true">
                  <path d="M12 5v14" />
                  <path d="M5 12h14" />
                </svg>
              </template>
              {{ t('room.settings_drawer.action_add') }}
            </n-button>
          </div>
        </div>

        <!-- Existing tags -->
        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.section_tags') }}</label>
          <div v-if="flow.hasTags.value" class="rs-tab__tag-list">
            <n-tag
              v-for="tag in flow.tags.value"
              :key="tag.name"
              closable
              size="medium"
              round
              :disabled="flow.updating.value"
              @close="handleRemove(tag.name)">
              {{ tag.name }}
            </n-tag>
          </div>
          <n-empty v-else :description="t('room.settings_drawer.tags_hint')" />
        </div>
      </section>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoomTags } from '@/composables/room/useRoomTags'

const props = defineProps<{ roomId: string }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()

const flow = useRoomTags({ roomId: () => props.roomId })

const inputValue = ref('')

async function handleAdd(): Promise<void> {
  const name = inputValue.value
  if (!name.trim()) return
  const ok = await flow.addTag(name)
  if (ok) {
    inputValue.value = ''
  }
}

async function handleRemove(name: string): Promise<void> {
  await flow.removeTag(name)
}

onMounted(() => {
  flow.load()
})
</script>

<style scoped lang="scss">
.rs-tab {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.rs-tab__section {
  display: flex;
  flex-direction: column;
}
.rs-tab__section-title {
  font-size: var(--tjg-font-size-sm);
  font-weight: var(--tjg-font-weight-medium);
  color: var(--tjg-text-secondary);
  margin: 0 0 10px 0;
}
.rs-tab__field {
  margin-bottom: 12px;
}
.rs-tab__field-label {
  display: block;
  font-size: var(--tjg-font-size-sm);
  color: var(--tjg-text-secondary);
  margin-bottom: 5px;
}
.rs-tab__add-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.rs-tab__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.rs-tab__hint {
  font-size: var(--tjg-font-size-xs);
  color: var(--tjg-text-tertiary);
  margin: 0 0 10px 0;
}

@media (prefers-reduced-motion: reduce) {
  .rs-tab,
  .rs-tab * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
