<template>
  <div class="thirdparty-browser" data-testid="thirdparty-browser">
    <n-card size="small" :bordered="true">
      <template #header>
        <span class="panel-title">{{ t('thirdparty.title') }}</span>
      </template>

      <n-spin :show="protocolsLoading" size="small">
        <p class="panel-subtitle">{{ t('thirdparty.subtitle') }}</p>

        <template v-if="protocolNames.length > 0">
          <div class="field-row">
            <label class="field-label">{{ t('thirdparty.protocol_select') }}</label>
            <n-select
              :value="selectedProtocol"
              :options="protocolOptions"
              :placeholder="t('thirdparty.protocol_placeholder')"
              data-testid="protocol-select"
              @update:value="handleProtocolChange" />
          </div>

          <div v-if="selectedProtocol" class="field-row">
            <label class="field-label">{{ t('thirdparty.query_field') }}</label>
            <n-select
              :value="selectedField"
              :options="fieldOptions"
              :placeholder="t('thirdparty.query_value_placeholder')"
              data-testid="field-select"
              @update:value="selectedField = $event" />
          </div>

          <div v-if="selectedProtocol" class="field-row">
            <label class="field-label">{{ t('thirdparty.query_value') }}</label>
            <n-input
              :value="queryValue"
              :placeholder="t('thirdparty.query_value_placeholder')"
              data-testid="query-value-input"
              @update:value="queryValue = $event" />
          </div>

          <div v-if="selectedProtocol" class="action-row">
            <n-button data-testid="query-location-btn" @click="handleQueryLocation">
              {{ t('thirdparty.query_location') }}
            </n-button>
            <n-button data-testid="query-user-btn" @click="handleQueryUser">
              {{ t('thirdparty.query_user') }}
            </n-button>
          </div>

          <div v-if="locationResults.length > 0" class="results-section">
            <div class="section-label">{{ t('thirdparty.location_results') }}</div>
            <div data-testid="location-results" class="results-grid">
              <div v-for="(item, idx) in locationResults" :key="`loc-${idx}`" class="result-item">
                <n-tag size="small">{{ item.alias ?? item.protocol ?? JSON.stringify(item) }}</n-tag>
              </div>
            </div>
          </div>

          <div v-if="userResults.length > 0" class="results-section">
            <div class="section-label">{{ t('thirdparty.user_results') }}</div>
            <div data-testid="user-results" class="results-grid">
              <div v-for="(item, idx) in userResults" :key="`usr-${idx}`" class="result-item">
                <n-tag size="small">{{ item.userid ?? item.protocol ?? JSON.stringify(item) }}</n-tag>
              </div>
            </div>
          </div>
        </template>

        <n-empty v-else :description="t('thirdparty.empty_protocols')" size="small" />
      </n-spin>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { synapseRustExtensionsService } from '@/services/matrix/SynapseRustExtensionsService'

const { t } = useI18n()

const protocolsLoading = ref(true)
const protocols = ref<Record<string, { location_fields?: string[]; user_fields?: string[] }>>({})
const selectedProtocol = ref<string | null>(null)
const selectedField = ref<string | null>(null)
const queryValue = ref('')
const locationResults = ref<Array<Record<string, unknown>>>([])
const userResults = ref<Array<Record<string, unknown>>>([])

const protocolNames = computed(() => Object.keys(protocols.value))

const protocolOptions = computed(() => protocolNames.value.map((name) => ({ label: name, value: name })))

const fieldOptions = computed(() => {
  if (!selectedProtocol.value) return []
  const proto = protocols.value[selectedProtocol.value]
  const fields = new Set<string>([...(proto?.location_fields ?? []), ...(proto?.user_fields ?? [])])
  return Array.from(fields).map((f) => ({ label: f, value: f }))
})

onMounted(async () => {
  protocolsLoading.value = true
  try {
    const result = await synapseRustExtensionsService.getThirdpartyProtocols()
    protocols.value = (result as Record<string, { location_fields?: string[]; user_fields?: string[] }>) ?? {}
  } catch {
    protocols.value = {}
  } finally {
    protocolsLoading.value = false
  }
})

function handleProtocolChange(value: string): void {
  selectedProtocol.value = value
  selectedField.value = null
  queryValue.value = ''
  locationResults.value = []
  userResults.value = []
}

function buildQueryParams(): Record<string, string> {
  const params: Record<string, string> = {}
  if (selectedField.value && queryValue.value.trim()) {
    params[selectedField.value] = queryValue.value.trim()
  }
  return params
}

async function handleQueryLocation(): Promise<void> {
  if (!selectedProtocol.value) return
  const result = await synapseRustExtensionsService.getThirdpartyLocation(selectedProtocol.value, buildQueryParams())
  locationResults.value = result ?? []
}

async function handleQueryUser(): Promise<void> {
  if (!selectedProtocol.value) return
  const result = await synapseRustExtensionsService.getThirdpartyUser(selectedProtocol.value, buildQueryParams())
  userResults.value = result ?? []
}
</script>

<style scoped>
.thirdparty-browser {
  width: 100%;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
}

.panel-subtitle {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--hula-text-tertiary);
  line-height: 1.5;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.field-label {
  font-size: 13px;
  color: var(--hula-text-secondary);
}

.action-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.results-section {
  margin-top: 12px;
}

.section-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--hula-text-secondary);
  margin-bottom: 8px;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.result-item {
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--hula-surface-search);
}
</style>
