import { presetWind3 } from '@unocss/preset-wind3'
import transformerDirectives from '@unocss/transformer-directives' // 设置指令
import transformerVariantGroup from '@unocss/transformer-variant-group' // 解决繁琐的多次写前缀的情况
import { defineConfig } from '@unocss/vite'

export default defineConfig({
  content: {
    pipeline: {
      exclude: ['node_modules', 'dist', '.git', '.vscode', 'public', 'build', 'config', 'src-tauri']
    }
  },
  presets: [
    presetWind3({
      dark: {
        dark: '[data-theme="dark"]',
        light: '[data-theme="light"]'
      }
    })
  ],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  /** 自定义规则  */
  rules: [
    [
      /^custom-shadow$/,
      () => ({
        'box-shadow': 'var(--shadow-enabled) 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
      })
    ]
  ],
  /**
   * 快捷键命名标准
   * @default '布局样式 - 水平样式 - 垂直样式'
   */
  shortcuts: {
    'flex-center': 'flex justify-center items-center',
    'flex-end-center': 'flex justify-end items-center',
    'flex-start-center': 'flex justify-start items-center',
    'flex-between-center': 'flex justify-between items-center',
    'flex-around-center': 'flex justify-around items-center',
    'flex-evenly-center': 'flex justify-evenly items-center',
    'flex-col-center': 'flex-center flex-col',
    'flex-col-x-center': 'flex flex-col items-center',
    'flex-col-y-center': 'flex flex-col justify-center',
    'flex-x-center': 'flex justify-center',
    'flex-y-center': 'flex items-center',
    'absolute-center': 'absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2',
    'absolute-flex-center': 'absolute flex-center left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2',
    'absolute-lt': 'absolute left-0 top-0',
    'absolute-lb': 'absolute left-0 bottom-0',
    'absolute-rt': 'absolute right-0 top-0',
    'absolute-rb': 'absolute right-0 bottom-0',
    'absolute-x-center': 'absolute-lt flex-x-center size-full',
    'absolute-y-center': 'absolute-lt flex-y-center size-full',
    'fixed-lt': 'fixed left-0 top-0',
    'fixed-lb': 'fixed left-0 bottom-0',
    'fixed-rt': 'fixed right-0 top-0',
    'fixed-rb': 'fixed right-0 bottom-0',
    'fixed-center': 'fixed-lt flex-center size-full'
  },

  theme: {
    colors: {
      background: 'var(--background)',
      foreground: 'var(--foreground)',
      border: 'var(--border)',
      card: 'var(--card)',
      'card-foreground': 'var(--card-foreground)',
      input: 'var(--input)',
      // 品牌色
      'hula-brand': 'var(--hula-brand)',
      'hula-primary': {
        100: 'var(--hula-color-primary-100)',
        200: 'var(--hula-color-primary-200)',
        300: 'var(--hula-color-primary-300)',
        400: 'var(--hula-color-primary-400)',
        500: 'var(--hula-color-primary-500)',
        600: 'var(--hula-color-primary-600)',
        700: 'var(--hula-color-primary-700)'
      },
      // 功能色
      'hula-success': {
        100: 'var(--hula-color-success-100)',
        400: 'var(--hula-color-success-400)',
        500: 'var(--hula-color-success-500)',
        600: 'var(--hula-color-success-600)'
      },
      'hula-warning': {
        100: 'var(--hula-color-warning-100)',
        400: 'var(--hula-color-warning-400)',
        500: 'var(--hula-color-warning-500)',
        600: 'var(--hula-color-warning-600)'
      },
      'hula-danger': {
        100: 'var(--hula-color-danger-100)',
        200: 'var(--hula-color-danger-200)',
        400: 'var(--hula-color-danger-400)',
        500: 'var(--hula-color-danger-500)',
        600: 'var(--hula-color-danger-600)'
      },
      'hula-info': {
        100: 'var(--hula-color-info-100)',
        400: 'var(--hula-color-info-400)',
        500: 'var(--hula-color-info-500)',
        600: 'var(--hula-color-info-600)'
      },
      // 文本色
      'hula-text': {
        primary: 'var(--hula-text-primary)',
        secondary: 'var(--hula-text-secondary)',
        tertiary: 'var(--hula-text-tertiary)',
        quaternary: 'var(--hula-text-quaternary)',
        disabled: 'var(--hula-text-disabled)',
        inverse: 'var(--hula-text-inverse)'
      },
      // 表面色
      'hula-surface': {
        app: 'var(--hula-surface-app)',
        panel: 'var(--hula-surface-panel)',
        'panel-muted': 'var(--hula-surface-panel-muted)',
        subtle: 'var(--hula-surface-subtle)',
        elevated: 'var(--hula-surface-elevated)',
        search: 'var(--hula-surface-search)',
        sidebar: 'var(--hula-surface-sidebar)'
      },
      // 边框色
      'hula-border': {
        default: 'var(--hula-border-default)',
        muted: 'var(--hula-border-muted)',
        strong: 'var(--hula-border-strong)'
      },
      // 状态色
      'hula-status': {
        online: 'var(--hula-status-online)',
        offline: 'var(--hula-status-offline)',
        busy: 'var(--hula-status-busy)',
        away: 'var(--hula-status-away)'
      }
    },
    fontSize: {
      'hula-xs': 'var(--hula-font-size-xs)',
      'hula-sm': 'var(--hula-font-size-sm)',
      'hula-base': 'var(--hula-font-size-base)',
      'hula-lg': 'var(--hula-font-size-lg)',
      'hula-xl': 'var(--hula-font-size-xl)',
      'hula-2xl': 'var(--hula-font-size-2xl)',
      'hula-3xl': 'var(--hula-font-size-3xl)'
    },
    borderRadius: {
      'hula-xs': 'var(--hula-radius-xs)',
      'hula-sm': 'var(--hula-radius-sm)',
      'hula-md': 'var(--hula-radius-md)',
      'hula-lg': 'var(--hula-radius-lg)',
      'hula-xl': 'var(--hula-radius-xl)',
      'hula-2xl': 'var(--hula-radius-2xl)',
      'hula-full': 'var(--hula-radius-full)'
    },
    // 统一断点：与 SCSS respond-to mixin 保持一致
    breakpoints: {
      sm: '576px',
      md: '768px',
      lg: '992px',
      xl: '1200px',
      '2xl': '1400px'
    }
  }
})
