import { NFlex } from 'naive-ui'
import type { VNode } from 'vue'
import { MacOsKeyEnum, WinKeyEnum } from '@/enums'
import { useI18nGlobal } from '@/services/i18n'
import { isWindows } from '@/utils/PlatformConstants'
import pkg from '~/package.json'
import { Button, Input, InputNumber, Select, Slider, Switch } from './model.tsx'

const { t } = useI18nGlobal()

const key = computed(() => {
  return `${isWindows() ? WinKeyEnum.CTRL : MacOsKeyEnum['⌘']}`
})

type ConfigItemType = 'system' | 'record' | 'identity' | 'cueWords' | 'APIAddress' | 'model' | 'clear'
type ChatConfig = {
  [key in ConfigItemType]: {
    title: string
    description?: string
    features: VNode
  }[]
}

/** chat 设置面板配置 */
export const content: ChatConfig = {
  system: [
    {
      title: t('ai_assistant.robot.current_version', { version: pkg.version }),
      description: t('ai_assistant.robot.already_latest'),
      features: <Button title={t('ai_assistant.robot.check_update')} icon={'refresh'} />
    },
    {
      title: t('ai_assistant.robot.send_key'),
      features: (
        <Select
          content={[
            { label: 'Enter', value: 'Enter' },
            { label: `${key.value} + Enter`, value: `${key.value}+Enter` }
          ]}
        />
      )
    },
    {
      title: t('ai_assistant.robot.theme'),
      features: (
        <Select
          content={[
            { label: t('ai_assistant.robot.light_theme'), value: 'light' },
            { label: t('ai_assistant.robot.dark_mode'), value: 'dark' },
            { label: t('ai_assistant.robot.follow_system'), value: 'auto' }
          ]}
        />
      )
    },
    {
      title: t('ai_assistant.robot.font_size'),
      description: t('ai_assistant.robot.font_size_desc'),
      features: <Slider min={12} max={20} value={14} />
    },
    {
      title: t('ai_assistant.robot.auto_generate_title'),
      description: t('ai_assistant.robot.auto_generate_title_desc'),
      features: <Switch active={false} />
    }
  ],
  record: [
    {
      title: t('ai_assistant.robot.cloud_data'),
      description: t('ai_assistant.robot.not_synced'),
      features: <Button title={t('ai_assistant.robot.configure')} icon={'setting-config'} />
    },
    {
      title: t('ai_assistant.robot.local_data'),
      description: t('ai_assistant.robot.local_data_desc'),
      features: (
        <NFlex align={'center'}>
          <Button title={t('ai_assistant.robot.import_data')} icon={'Export'} />
          <Button title={t('ai_assistant.robot.export_data')} icon={'Importing'} />
        </NFlex>
      )
    }
  ],
  identity: [
    {
      title: t('ai_assistant.robot.identity_start_page'),
      description: t('ai_assistant.robot.identity_start_page_desc'),
      features: <Switch active={true} />
    },
    {
      title: t('ai_assistant.robot.hide_builtin_identity'),
      description: t('ai_assistant.robot.hide_builtin_identity_desc'),
      features: <Switch active={false} />
    }
  ],
  cueWords: [
    {
      title: t('ai_assistant.robot.disable_prompt_autocomplete'),
      description: t('ai_assistant.robot.disable_prompt_autocomplete_desc'),
      features: <Switch active={false} />
    },
    {
      title: t('ai_assistant.robot.custom_prompt_list'),
      description: t('ai_assistant.robot.custom_prompt_list_desc'),
      features: <Button title={t('ai_assistant.robot.edit_btn')} icon={'edit'} />
    }
  ],
  APIAddress: [
    {
      title: t('ai_assistant.robot.model_provider'),
      description: t('ai_assistant.robot.switch_provider_desc'),
      features: (
        <Select
          content={[
            { label: 'openAi', value: 'openAi' },
            { label: 'Azure', value: 'Azure' },
            { label: 'Google', value: 'Google' }
          ]}
        />
      )
    },
    {
      title: t('ai_assistant.robot.api_endpoint'),
      description: t('ai_assistant.robot.api_endpoint_desc'),
      features: <Input value={'www.baidu.com'} />
    },
    {
      title: t('ai_assistant.robot.api_key_custom'),
      description: t('ai_assistant.robot.api_key_custom_desc'),
      features: <Input value={'123456'} isPassword={true} />
    }
  ],
  model: [
    {
      title: t('ai_assistant.robot.model_label_simple'),
      features: (
        <Select
          content={[
            { label: 'gpt-3.5-turbo', value: 'gpt-3.5-turbo' },
            { label: 'gpt-4o', value: 'gpt-4o' },
            { label: 'gpt-4-32k', value: 'gpt-4-32k' },
            { label: 'gpt-4-turbo', value: 'gpt-4-turbo' }
          ]}
        />
      )
    },
    {
      title: t('ai_assistant.robot.randomness'),
      description: t('ai_assistant.robot.randomness_desc'),
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: t('ai_assistant.robot.top_p'),
      description: t('ai_assistant.robot.top_p_desc'),
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: t('ai_assistant.robot.max_tokens_limit'),
      description: t('ai_assistant.robot.max_tokens_limit_desc'),
      features: <InputNumber value={4000} min={2000} max={10000} />
    },
    {
      title: t('ai_assistant.robot.presence_penalty'),
      description: t('ai_assistant.robot.presence_penalty_desc'),
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: t('ai_assistant.robot.frequency_penalty'),
      description: t('ai_assistant.robot.frequency_penalty_desc'),
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: t('ai_assistant.robot.inject_system_prompt'),
      description: t('ai_assistant.robot.inject_system_prompt_desc'),
      features: <Switch active={false} />
    },
    {
      title: t('ai_assistant.robot.user_input_preprocess'),
      description: t('ai_assistant.robot.user_input_preprocess_desc'),
      features: <Input value={'input'} />
    },
    {
      title: t('ai_assistant.robot.history_message_count'),
      description: t('ai_assistant.robot.history_message_count_desc'),
      features: <Slider min={0} max={10} value={5} />
    },
    {
      title: t('ai_assistant.robot.history_compress_threshold'),
      description: t('ai_assistant.robot.history_compress_threshold_desc'),
      features: <InputNumber value={1000} min={0} max={5000} />
    },
    {
      title: t('ai_assistant.robot.history_summary'),
      description: t('ai_assistant.robot.history_summary_desc'),
      features: <Switch active={true} />
    }
  ],
  clear: [
    {
      title: t('ai_assistant.robot.reset_all_settings'),
      description: t('ai_assistant.robot.reset_all_settings_desc'),
      features: <Button title={t('ai_assistant.robot.reset_now')} isSecondary={true} />
    },
    {
      title: t('ai_assistant.robot.clear_all_data'),
      description: t('ai_assistant.robot.clear_all_data_desc'),
      features: <Button title={t('ai_assistant.robot.clear_now')} isSecondary={true} />
    }
  ]
}
