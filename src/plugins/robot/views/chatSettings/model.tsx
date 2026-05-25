import {
  type GlobalThemeOverrides,
  NButton,
  NConfigProvider,
  NFlex,
  NInput,
  NInputNumber,
  NSelect,
  NSlider,
  NSwitch
} from 'naive-ui'
import { useI18nGlobal } from '@/services/i18n'

const { t } = useI18nGlobal()

const commonTheme: GlobalThemeOverrides = {
  Input: {
    borderRadius: '10px',
    borderHover: `1px solid var(--hula-border-default)`,
    border: `1px solid var(--hula-border-default)`,
    borderDisabled: `1px solid var(--hula-border-default)`,
    borderFocus: `1px solid var(--hula-border-default)`,
    boxShadowFocus: `1px solid var(--hula-border-default)`
  }
}

export const Button = defineComponent(
  (props: { title: string; icon?: string; isSecondary?: boolean; onClick?: () => void }) => {
    const loading = ref(false)
    const handleClick = () => {
      if (props.onClick) {
        props.onClick()
        return
      }
      loading.value = true
      setTimeout(() => {
        loading.value = false
      }, 1000)
    }
    return () => (
      <NButton
        loading={loading.value}
        onClick={handleClick}
        type={props.isSecondary ? 'error' : 'default'}
        quaternary={!props.isSecondary}
        secondary={props.isSecondary}
        size={'small'}>
        {{
          icon: () =>
            props.icon ? (
              <svg class={'size-12px'}>
                <use href={`#${props.icon}`}></use>
              </svg>
            ) : (
              void 0
            ),
          default: () => props.title
        }}
      </NButton>
    )
  },
  {
    props: ['title', 'icon', 'isSecondary', 'onClick']
  }
)

export const Select = defineComponent(
  (props: {
    content: Array<{ label: string; value: string | number }>
    value?: string | number
    onUpdateValue?: (value: string | number) => void
  }) => {
    const v = ref(props.value ?? props.content[0].value)
    watch(
      () => props.value,
      (newVal) => {
        if (newVal !== undefined) v.value = newVal
      }
    )
    const handleChange = (val: string | number) => {
      v.value = val
      props.onUpdateValue?.(val)
    }
    return () => (
      <NSelect
        class={'w-120px rounded-8px'}
        consistentMenuWidth={false}
        size={'small'}
        value={v.value}
        options={props.content}
        onUpdateValue={handleChange}
      />
    )
  },
  {
    props: ['content', 'value', 'onUpdateValue']
  }
)

export const Slider = defineComponent(
  (props: {
    value: number
    max: number
    min: number
    isDecimal?: boolean
    onUpdateValue?: (value: number) => void
  }) => {
    const v = ref(props.value)
    watch(
      () => props.value,
      (newVal) => {
        v.value = newVal
      }
    )
    const handleChange = (val: number | null) => {
      if (val === null) return
      v.value = val
      props.onUpdateValue?.(val)
    }
    const formatTooltip = (value: number) => `${value}`
    return () => (
      <NFlex align={'center'} size={12}>
        <NConfigProvider themeOverrides={commonTheme}>
          <NInputNumber
            min={props.min}
            max={props.max}
            class={'w-80px'}
            value={v.value}
            onUpdateValue={handleChange}
            size="tiny"
          />
        </NConfigProvider>
        <NSlider
          class={'w-160px'}
          formatTooltip={formatTooltip}
          value={v.value}
          onUpdateValue={handleChange}
          max={props.max}
          min={props.min}
        />
      </NFlex>
    )
  },
  {
    props: ['value', 'max', 'min', 'onUpdateValue']
  }
)

export const Switch = defineComponent(
  (props: { active: boolean; onUpdateValue?: (value: boolean) => void }) => {
    const v = ref(props.active)
    watch(
      () => props.active,
      (newVal) => {
        v.value = newVal
      }
    )
    const handleChange = (val: boolean) => {
      v.value = val
      props.onUpdateValue?.(val)
    }
    return () => (
      <NSwitch
        value={v.value}
        onUpdateValue={handleChange}
        class={'text-(12px [--hula-text-secondary])'}
        size={'small'}>
        {{
          checked: () => t('ai_assistant.robot.on'),
          unchecked: () => t('ai_assistant.robot.off')
        }}
      </NSwitch>
    )
  },
  {
    props: ['active', 'onUpdateValue']
  }
)

export const Input = defineComponent(
  (props: { value: string; isPassword?: boolean; onUpdateValue?: (value: string) => void }) => {
    const v = ref(props.value)
    watch(
      () => props.value,
      (newVal) => {
        v.value = newVal
      }
    )
    const handleChange = (val: string) => {
      v.value = val
      props.onUpdateValue?.(val)
    }
    return () => (
      <NConfigProvider themeOverrides={commonTheme}>
        <NInput
          style={{ width: '160px' }}
          value={v.value}
          onUpdateValue={handleChange}
          type={props.isPassword ? 'password' : 'text'}
          size={'small'}
          showPasswordOn={'click'}
        />
      </NConfigProvider>
    )
  },
  { props: ['value', 'isPassword', 'onUpdateValue'] }
)

export const InputNumber = defineComponent(
  (props: { value: number; max: number; min: number; onUpdateValue?: (value: number) => void }) => {
    const v = ref(props.value)
    watch(
      () => props.value,
      (newVal) => {
        v.value = newVal
      }
    )
    const handleChange = (val: number | null) => {
      if (val === null) return
      v.value = val
      props.onUpdateValue?.(val)
    }
    return () => (
      <NInputNumber
        style={{ width: '120px', borderRadius: '10px', border: '1px solid var(--hula-border-default)' }}
        min={props.min}
        max={props.max}
        value={v.value}
        onUpdateValue={handleChange}
        step={100}
        size={'small'}
      />
    )
  },
  { props: ['value', 'onUpdateValue'] }
)
