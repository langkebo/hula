type StorybookPerfSample = {
  name: string
  duration: number
  thresholdMs: number
  startedAt: number
  completedAt: number
  route: string
  status: 'pass' | 'warn'
}

declare global {
  interface Window {
    __HULA_STORYBOOK_PERF_SAMPLES__?: StorybookPerfSample[]
  }
}

const activeSamples: Record<
  string,
  {
    startedAt: number
    thresholdMs: number
    route: string
  }
> = {}

const ensurePerfStore = () => {
  if (typeof window === 'undefined') return []
  window.__HULA_STORYBOOK_PERF_SAMPLES__ ??= []
  return window.__HULA_STORYBOOK_PERF_SAMPLES__
}

export const resetStorybookPerfSamples = () => {
  Object.keys(activeSamples).forEach((key) => {
    delete activeSamples[key]
  })
  ensurePerfStore().length = 0
}

export const startStorybookPerfSample = (
  name: string,
  options: {
    thresholdMs: number
    route: string
  }
) => {
  activeSamples[name] = {
    startedAt: performance.now(),
    thresholdMs: options.thresholdMs,
    route: options.route
  }
}

export const completeStorybookPerfSample = (name: string) => {
  const activeSample = activeSamples[name]
  if (!activeSample) return null

  delete activeSamples[name]
  const completedAt = performance.now()
  const duration = completedAt - activeSample.startedAt
  const sample: StorybookPerfSample = {
    name,
    duration,
    thresholdMs: activeSample.thresholdMs,
    startedAt: activeSample.startedAt,
    completedAt,
    route: activeSample.route,
    status: duration <= activeSample.thresholdMs ? 'pass' : 'warn'
  }
  ensurePerfStore().push(sample)
  return sample
}

export const completeStorybookPerfSampleOnNextFrame = (name: string) => {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      completeStorybookPerfSample(name)
    })
  })
}
