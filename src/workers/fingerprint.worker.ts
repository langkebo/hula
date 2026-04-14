/// <reference lib="webworker" />

// 检测浏览器特征
const detectBrowserFeatures = async (): Promise<Record<string, boolean>> => {
  const features: Record<string, boolean> = {}

  const checks = {
    webgl: async () => {
      try {
        const canvas = new OffscreenCanvas(1, 1)
        return !!canvas.getContext('webgl')
      } catch {
        // WebGL 不可用时返回 false
        return false
      }
    },
    canvas: async () => {
      try {
        const canvas = new OffscreenCanvas(1, 1)
        return !!canvas.getContext('2d')
      } catch {
        // Canvas 不可用时返回 false
        return false
      }
    },
    audio: async () => {
      try {
        const workerGlobalScope = self as unknown as {
          AudioContext?: typeof AudioContext
          webkitAudioContext?: typeof AudioContext
        }
        return !!(workerGlobalScope.AudioContext || workerGlobalScope.webkitAudioContext)
      } catch {
        // Audio API 不可用时返回 false
        return false
      }
    }
  }

  const results = await Promise.all(
    Object.entries(checks).map(async ([key, check]) => {
      try {
        const result = await check()
        return [key, result]
      } catch {
        // 特征检测失败时返回 false
        return [key, false]
      }
    })
  )

  results.forEach(([key, value]) => {
    features[key as string] = value as boolean
  })

  return features
}

// 生成设备指纹
const generateFingerprint = async (data: { deviceInfo: any; browserFingerprint: string }): Promise<string> => {
  try {
    const totalStart = performance.now()

    // 2. 浏览器特征检测
    const featureStart = performance.now()
    const browserFeatures = await detectBrowserFeatures()
    const _featureTime = performance.now() - featureStart

    // 3. 组合所有特征
    const hashStart = performance.now()
    const combinedFingerprint = JSON.stringify({
      browserFingerprint: data.browserFingerprint,
      deviceInfo: data.deviceInfo,
      browserFeatures,
      timestamp: Date.now()
    })

    // 4. 使用 SHA-256 生成最终指纹
    const fingerprintBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(combinedFingerprint))

    const fingerprint = Array.from(new Uint8Array(fingerprintBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
    const _hashTime = performance.now() - hashStart

    const _totalTime = performance.now() - totalStart

    return fingerprint
  } catch (_error) {
    return ''
  }
}

// 监听主线程消息
self.onmessage = async (e) => {
  const { type, deviceInfo, browserFingerprint } = e.data

  if (type === 'generateFingerprint') {
    const fingerprint = await generateFingerprint({ deviceInfo, browserFingerprint })
    self.postMessage({ type: 'fingerprintGenerated', fingerprint })
  }
}
