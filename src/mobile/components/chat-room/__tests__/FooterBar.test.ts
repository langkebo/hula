import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

vi.mock('vant/es/dialog/style', () => ({}))
vi.mock('@iconify/vue', () => ({ Icon: { name: 'Icon', template: '<i />' } }))
vi.mock('@/stores/domains/widget/global', () => ({
  useGlobalStore: () => ({ currentSession: { detailId: '!room:hs' } })
}))
vi.mock('@/utils/PlatformConstants', () => ({ isIOS: () => false }))
vi.mock('@/utils/TauriInvokeHandler', () => ({ invokeSilently: vi.fn() }))
vi.mock('@/components/rightBox/chatBox/ChatFooter.vue', () => ({
  default: { name: 'ChatFooter', template: '<div />' }
}))
vi.mock('@/mobile/components/chat-room/panel/VoicePanel.vue', () => ({
  default: { name: 'VoicePanel', template: '<div />' }
}))

import FooterBar from '../FooterBar.vue'

class ResizeObserverStub {
  static instances: ResizeObserverStub[] = []

  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn(() => {
    this.disconnected = true
  })

  disconnected = false

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this)
  }

  trigger(height: number) {
    if (this.disconnected) return
    this.callback([{ contentRect: { height } } as ResizeObserverEntry], this as unknown as ResizeObserver)
  }
}

const extractCallArgs = (source: string, callName: string): string => {
  const start = source.indexOf(`${callName}(`)
  if (start === -1) throw new Error(`${callName} not found`)
  const open = start + callName.length
  let depth = 0
  for (let i = open; i < source.length; i++) {
    if (source[i] === '(') depth++
    else if (source[i] === ')') {
      depth--
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  throw new Error(`${callName} arguments are unbalanced`)
}

const extractCallBody = (source: string, callName: string): string => {
  const args = extractCallArgs(source, callName)
  const open = args.indexOf('{')
  if (open === -1) throw new Error(`${callName} has no block body`)
  let depth = 0
  for (let i = open; i < args.length; i++) {
    if (args[i] === '{') depth++
    else if (args[i] === '}') {
      depth--
      if (depth === 0) return args.slice(open + 1, i)
    }
  }
  throw new Error(`${callName} body is unbalanced`)
}

const i18n = createI18n({
  legacy: false,
  locale: 'en-US',
  messages: {
    'en-US': {
      location_share: { title: 'Location' },
      mobile_chat: { keyboard: 'Keyboard', voice: 'Voice' }
    }
  } as never
})

const mountFooterBar = (onUpdateHeight: (height: number) => void) =>
  mount(FooterBar, {
    props: { onUpdateHeight },
    global: {
      plugins: [i18n],
      stubs: {
        VoicePanel: true,
        'chat-footer': true,
        'van-button': { template: '<button><slot /><slot name="icon" /></button>' }
      }
    }
  })

describe('FooterBar lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ResizeObserverStub.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  it('registers observer cleanup in setup scope, not inside the mount callback', () => {
    const source = readFileSync(resolve(__dirname, '../FooterBar.vue'), 'utf-8')
    expect(source).toContain('let resizeObserver: ResizeObserver | null = null')
    expect(source).not.toMatch(/(?:const|let)\s+\w+\s*=\s*new\s+ResizeObserver/)

    const onMountedBody = extractCallBody(source, 'onMounted')
    expect(onMountedBody).not.toMatch(/on(Before)?Unmount|onScopeDispose/)

    const onUnmountedBody = extractCallBody(source, 'onUnmounted')
    expect(onUnmountedBody).toMatch(/resizeObserver\??\.disconnect\(\)/)
  })

  it('observes the root element and disconnects the resize observer on unmount', () => {
    const onUpdateHeight = vi.fn()
    const wrapper = mountFooterBar(onUpdateHeight)

    expect(ResizeObserverStub.instances).toHaveLength(1)
    const observer = ResizeObserverStub.instances[0]
    expect(observer.observe).toHaveBeenCalledTimes(1)

    observer.trigger(180)
    expect(onUpdateHeight).toHaveBeenCalledTimes(1)
    expect(onUpdateHeight).toHaveBeenCalledWith(180)

    wrapper.unmount()
    expect(observer.disconnect).toHaveBeenCalledTimes(1)
  })
})
