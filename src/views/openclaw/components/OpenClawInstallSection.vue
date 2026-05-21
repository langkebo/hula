<template>
  <section class="openclaw-workbench__install-status">
    <div class="openclaw-workbench__install-head">
      <div class="openclaw-workbench__install-copy">
        <strong>{{ installStatusTitle }}</strong>
        <span>{{ installStatusDescription }}</span>
      </div>
      <div class="openclaw-workbench__install-actions">
        <n-button
          v-if="ctx.installStatus?.state === 'not_installed'"
          type="primary"
          size="small"
          :loading="ctx.installingOpenClaw"
          @click="ctx.handleInstallOpenClaw()">
          {{ ctx.translate('ai_assistant.robot.openclaw_install_btn') }}
        </n-button>
        <n-button
          v-else
          quaternary
          circle
          size="small"
          :loading="ctx.installStatusLoading"
          @click="ctx.loadInstallStatus()">
          <template #icon>
            <svg><use href="#refresh"></use></svg>
          </template>
        </n-button>
      </div>
    </div>

    <div v-if="ctx.installingOpenClaw || ctx.installLogs.length > 0" class="openclaw-workbench__install-logs">
      <div v-for="(log, index) in ctx.installLogs" :key="index" class="openclaw-workbench__install-log">
        {{ log }}
      </div>
    </div>

    <div v-if="showManualInstallGuide" class="openclaw-workbench__manual-install">
      <p>{{ ctx.translate('ai_assistant.robot.openclaw_manual_install_guide') }}</p>
      <div v-if="ctx.installStatus?.manualInstallCommand" class="openclaw-workbench__command-box">
        <code>{{ ctx.installStatus.manualInstallCommand }}</code>
        <n-button size="tiny" quaternary @click="ctx.handleCopyMessage(ctx.installStatus!.manualInstallCommand!, '')">
          {{ ctx.translate('common.copy') }}
        </n-button>
      </div>
      <ul v-if="ctx.installStatus?.manualInstallSteps" class="openclaw-workbench__steps">
        <li v-for="(step, index) in ctx.installStatus.manualInstallSteps" :key="index">
          {{ step }}
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useOpenClawContext } from '../composables/useOpenClawContext'

const ctx = useOpenClawContext()

const installStatusTitle = computed(() => {
  switch (ctx.installStatus?.state) {
    case 'installed':
      return ctx.translate('ai_assistant.robot.openclaw_install_title_installed')
    case 'not_installed':
      return ctx.translate('ai_assistant.robot.openclaw_install_title_not_installed')
    case 'unsupported':
      return ctx.translate('ai_assistant.robot.openclaw_install_title_unsupported')
    default:
      return ctx.translate('ai_assistant.robot.openclaw_install_title_default')
  }
})

const installStatusDescription = computed(() => {
  if (ctx.installErrorMessage) return ctx.installErrorMessage
  switch (ctx.installStatus?.state) {
    case 'installed':
      return ctx.translate('ai_assistant.robot.openclaw_install_desc_installed')
    case 'not_installed':
      return ctx.translate('ai_assistant.robot.openclaw_install_desc_not_installed')
    case 'unsupported':
      return ctx.translate('ai_assistant.robot.openclaw_install_desc_unsupported')
    default:
      return ctx.translate('ai_assistant.robot.openclaw_install_desc_default')
  }
})

const showManualInstallGuide = computed(() =>
  Boolean(
    ctx.installStatus &&
    (!ctx.installStatus.isInstalled || ctx.installErrorMessage) &&
    ((ctx.installStatus.manualInstallSteps?.length ?? 0) > 0 || ctx.installStatus.manualInstallCommand)
  )
)
</script>

<style scoped>
.openclaw-workbench__install-status {
  padding: 16px;
  border-radius: 16px;
  background: var(--bg-msg-hover);
  border: 1px solid var(--line-color);
}

.openclaw-workbench__install-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.openclaw-workbench__install-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.openclaw-workbench__install-copy strong {
  font-size: 14px;
  color: var(--text-color);
}

.openclaw-workbench__install-copy span {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.openclaw-workbench__install-logs {
  margin-top: 12px;
  padding: 10px;
  border-radius: 8px;
  background: var(--right-bg-color);
  max-height: 120px;
  overflow-y: auto;
}

.openclaw-workbench__install-log {
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-tertiary);
}

.openclaw-workbench__manual-install {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px dashed var(--line-color);
}

.openclaw-workbench__manual-install p {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.openclaw-workbench__command-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--right-bg-color);
  border: 1px solid var(--line-color);
}

.openclaw-workbench__command-box code {
  font-size: 12px;
  color: var(--color-primary);
}

.openclaw-workbench__steps {
  margin: 10px 0 0;
  padding-left: 18px;
  font-size: 12px;
  color: var(--color-text-tertiary);
}

.openclaw-workbench__steps li + li {
  margin-top: 4px;
}
</style>
