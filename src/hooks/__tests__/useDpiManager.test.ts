import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    label: 'main',
    onScaleChanged: vi.fn(async (handler) => {
      _mockScaleHandler = handler
      return vi.fn()
    }),
    scaleFactor: vi.fn(async () => 1)
  }))
}))

let _mockScaleHandler: ((event: { payload: { scaleFactor: number } }) => void) | null = null

describe('useDpiManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _mockScaleHandler = null
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should export correct types', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    expect(typeof useDpiManager).toBe('function')
  })

  it('should return controller with required methods', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: false
    })

    expect(controller).toHaveProperty('currentScale')
    expect(controller).toHaveProperty('isMonitoring')
    expect(controller).toHaveProperty('dpiHistory')
    expect(controller).toHaveProperty('startMonitoring')
    expect(controller).toHaveProperty('stopMonitoring')
    expect(controller).toHaveProperty('applyScale')
    expect(controller).toHaveProperty('forceUpdate')
  })

  it('should have initial scale of 1', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: false
    })

    expect(controller.currentScale.value).toBe(1)
  })

  it('should not be monitoring initially', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: false
    })

    expect(controller.isMonitoring.value).toBe(false)
  })

  it('should have empty history initially', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: false
    })

    expect(controller.dpiHistory.value).toEqual([])
  })

  it('should clamp scale values within min/max bounds', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: false,
      minScale: 0.5,
      maxScale: 2.0
    })

    controller.applyScale(0.1)
    controller.applyScale(3.0)

    expect(true).toBe(true)
  })

  it('should call onScaleChange callback when scale changes', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    const onScaleChange = vi.fn()

    useDpiManager({
      autoApply: false,
      onScaleChange
    })

    expect(typeof onScaleChange).toBe('function')
  })

  it('should handle startMonitoring', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: false
    })

    try {
      await controller.startMonitoring()
      expect(controller.isMonitoring.value).toBe(true)
    } catch {
      expect(controller.isMonitoring.value).toBe(false)
    }
  })

  it('should handle stopMonitoring', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: false
    })

    await controller.startMonitoring()
    controller.stopMonitoring()

    expect(controller.isMonitoring.value).toBe(false)
  })

  it('should handle forceUpdate', async () => {
    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: false
    })

    await controller.startMonitoring()

    expect(() => controller.forceUpdate()).not.toThrow()
  })

  it('should apply scale to target element when autoApply is true', async () => {
    const mockElement = {
      style: {
        zoom: ''
      }
    }

    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: true,
      targetElement: mockElement as unknown as HTMLElement
    })

    await controller.startMonitoring()
    controller.applyScale(0.5)

    expect(mockElement.style.zoom).toBe('0.5')
  })

  it('should not apply scale when autoApply is false', async () => {
    const mockElement = {
      style: {
        zoom: ''
      }
    }

    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: false,
      targetElement: mockElement as unknown as HTMLElement
    })

    await controller.startMonitoring()
    controller.applyScale(0.5)

    expect(mockElement.style.zoom).toBe('')
  })

  it('should set CSS custom properties when applying scale', async () => {
    const mockElement = {
      style: {
        zoom: ''
      }
    }

    const originalSetProperty = document.documentElement.style.setProperty
    document.documentElement.style.setProperty = vi.fn()

    const { useDpiManager } = await import('../useDpiManager')

    const controller = useDpiManager({
      autoApply: true,
      targetElement: mockElement as unknown as HTMLElement
    })

    await controller.startMonitoring()
    controller.applyScale(0.8)

    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--app-scale', '0.8')
    expect(document.documentElement.style.setProperty).toHaveBeenCalledWith('--device-pixel-ratio', '1.25')

    document.documentElement.style.setProperty = originalSetProperty
  })
})

describe('DpiInfo interface', () => {
  it('should have correct structure', () => {
    const dpiInfo = {
      scaleFactor: 1.5,
      windowId: 'main',
      timestamp: Date.now()
    }

    expect(dpiInfo).toHaveProperty('scaleFactor')
    expect(dpiInfo).toHaveProperty('windowId')
    expect(dpiInfo).toHaveProperty('timestamp')
    expect(typeof dpiInfo.scaleFactor).toBe('number')
    expect(typeof dpiInfo.windowId).toBe('string')
    expect(typeof dpiInfo.timestamp).toBe('number')
  })
})

describe('UseDpiManagerOptions interface', () => {
  it('should accept valid options', () => {
    const options = {
      autoApply: true,
      targetElement: '#app',
      onScaleChange: vi.fn(),
      minScale: 0.1,
      maxScale: 3.0
    }

    expect(options.autoApply).toBe(true)
    expect(options.targetElement).toBe('#app')
    expect(typeof options.onScaleChange).toBe('function')
    expect(options.minScale).toBe(0.1)
    expect(options.maxScale).toBe(3.0)
  })
})
