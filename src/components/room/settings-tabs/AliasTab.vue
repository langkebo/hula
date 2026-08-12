<template>
  <div class="rs-tab" data-testid="alias-tab">
    <n-spin :show="loading">
      <!-- Main Alias Section -->
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.section_alias') }}</h4>

        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_main_alias') }}</label>
          <n-input :value="mainAlias" readonly placeholder="—" />
        </div>

        <!-- Add Alias -->
        <div class="rs-tab__field">
          <label class="rs-tab__field-label">{{ t('room.settings_drawer.field_add_alias') }}</label>
          <div class="rs-tab__add-row">
            <n-input
              v-model:value="newAlias"
              :placeholder="t('room.settings_drawer.field_add_alias')"
              :disabled="adding"
              @keydown.enter="handleAddAlias" />
            <n-button type="primary" :loading="adding" :disabled="!newAlias.trim()" @click="handleAddAlias">
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
      </section>

      <!-- Published Aliases -->
      <section class="rs-tab__section">
        <h4 class="rs-tab__section-title">{{ t('room.settings_drawer.field_published_aliases') }}</h4>
        <div v-if="publishedAliases.length > 0" class="rs-tab__tag-list">
          <n-tag
            v-for="alias in publishedAliases"
            :key="alias"
            closable
            :disabled="removing"
            @close="handleRemoveAlias(alias)">
            {{ alias }}
          </n-tag>
        </div>
        <n-empty v-else :description="t('room.settings_drawer.field_published_aliases')" />
      </section>
    </n-spin>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { matrixRoomActionFacade } from '@/services/matrix/room/ActionFacade'

const props = defineProps<{ roomId: string }>()
defineEmits<{ close: [] }>()

const { t } = useI18n()
const { showFeedback } = useActionFeedback()

const loading = ref(false)
const adding = ref(false)
const removing = ref(false)
const aliases = ref<string[]>([])
const newAlias = ref('')

const mainAlias = computed(() => aliases.value[0] ?? '')
const publishedAliases = computed(() => aliases.value.slice(1))

async function loadAliases(): Promise<void> {
  loading.value = true
  try {
    aliases.value = await matrixRoomActionFacade.getAliases(props.roomId)
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    loading.value = false
  }
}

async function handleAddAlias(): Promise<void> {
  const alias = newAlias.value.trim()
  if (!alias) return
  adding.value = true
  try {
    await matrixRoomActionFacade.setRoomAlias(props.roomId, alias)
    newAlias.value = ''
    await loadAliases()
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    adding.value = false
  }
}

async function handleRemoveAlias(alias: string): Promise<void> {
  removing.value = true
  try {
    await matrixRoomActionFacade.deleteRoomAlias(alias)
    await loadAliases()
    showFeedback(t('room.settings_drawer.saved_success'), 'success')
  } catch {
    showFeedback(t('room.settings_drawer.saved_failed'), 'error')
  } finally {
    removing.value = false
  }
}

onMounted(loadAliases)
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

@media (prefers-reduced-motion: reduce) {
  .rs-tab,
  .rs-tab * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
