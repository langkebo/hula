<template>
  <div ref="container" class="assistant-view">
    <div v-if="props.active && !isReady" class="assistant-view__placeholder">
      <n-progress
        :percentage="loadingProgress"
        :show-indicator="false"
        :height="6"
        :stroke-width="10"
        :color="'var(--tjg-color-primary-500)'"
        :rail-color="'rgba(19, 152, 127, 0.3)'"
        class="assistant-view__progress"
        type="line" />
      <span class="assistant-view__placeholder-text">
        {{ loadingProgress === 0 ? '开始加载模型...' : `模型加载中 ${loadingProgress}%` }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { convertFileSrc } from '@tauri-apps/api/core'
import { join, resourceDir } from '@tauri-apps/api/path'
import type {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Clock,
  Group,
  Mesh,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer
} from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { useAssistantModelPresets } from '@/composables/chat/useAssistantModelPresets'
import { useActionFeedback } from '@/composables/common/useActionFeedback'
import { createLogger } from '@/utils/Logger'
import { ensureModelFile } from '@/utils/PathUtil'
import { isDesktop } from '@/utils/PlatformConstants'
import { invokeSilently } from '@/utils/TauriInvokeHandler'

const logger = createLogger('TjgAssistant')
const { showFeedback } = useActionFeedback()

// 动态导入 three.js 核心及插件
const getThree = async () => {
  const [three, { OrbitControls }, { DRACOLoader }, { GLTFLoader }] = await Promise.all([
    import('three'),
    import('three/examples/jsm/controls/OrbitControls.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
    import('three/examples/jsm/loaders/GLTFLoader.js')
  ])
  return { ...three, OrbitControls, DRACOLoader, GLTFLoader }
}

const props = defineProps<{
  active: boolean
  customModel?: string | null
}>()

const emit = defineEmits<{
  (event: 'ready'): void
  (event: 'error', error: unknown): void
}>()

const container = ref<HTMLDivElement | null>(null)
const isReady = ref(false)
const loadingProgress = ref(0)

const TARGET_SIZE = 1.4
const LIFT_RATIO = 0.1
const TARGET_OFFSET_RATIO = 0.04
const CAMERA_DISTANCE_FACTOR = 2.2
const CAMERA_HEIGHT_FACTOR = 0.18
const DRACO_DECODER_BASE_URL = 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/'

type ThreeRuntimeModule = Awaited<ReturnType<typeof getThree>>

let ThreeModule: ThreeRuntimeModule | null = null
let clock: Clock | null = null

let renderer: WebGLRenderer | null = null
let scene: Scene | null = null
let camera: PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let model: Group | null = null
let modelWrapper: Group | null = null
let animationFrameId: number | null = null
let resizeObserver: ResizeObserver | null = null
let initialized = false
let activating = false
let currentCustomSource: string | null = null
let mixer: AnimationMixer | null = null
let activeAction: AnimationAction | null = null
let availableClips: AnimationClip[] = []
let dracoLoader: DRACOLoader | null = null
let dracoDecoderBasePath: string | null = null
let lastResolvedModelSource: string | null = null
const { metaMap: assistantModelMetaMap } = useAssistantModelPresets()

const isRemoteSource = (source: string) => /^https?:\/\//i.test(source)

const resolveDracoDecoderPath = async () => {
  if (dracoDecoderBasePath) {
    return dracoDecoderBasePath
  }
  if (isDesktop()) {
    try {
      const resourceBase = await resourceDir()
      const dracoDir = await join(resourceBase, 'draco')
      const assetUrl = convertFileSrc(dracoDir)
      dracoDecoderBasePath = assetUrl.endsWith('/') ? assetUrl : `${assetUrl}/`
      return dracoDecoderBasePath
    } catch (error) {
      logger.warn('获取 Draco 解码器资源路径失败, 回退 CDN', error)
    }
  }
  dracoDecoderBasePath = DRACO_DECODER_BASE_URL
  return dracoDecoderBasePath
}

const ensureDracoLoader = async () => {
  if (!ThreeModule) {
    throw new Error('THREE_MODULE_NOT_READY')
  }
  const threeModule = ThreeModule

  if (!dracoLoader) {
    dracoLoader = new threeModule.DRACOLoader()
    dracoLoader.setDecoderConfig({ type: 'wasm' })
    let decoderPath = await resolveDracoDecoderPath()
    dracoLoader.setDecoderPath(decoderPath)
    try {
      dracoLoader.preload()
    } catch (error) {
      if (decoderPath !== DRACO_DECODER_BASE_URL) {
        logger.warn('预加载本地 Draco 解码器失败, 回退 CDN', error)
        dracoDecoderBasePath = DRACO_DECODER_BASE_URL
        decoderPath = DRACO_DECODER_BASE_URL
        dracoLoader.setDecoderPath(decoderPath)
        dracoLoader.preload()
      } else {
        throw error
      }
    }
  }
  return dracoLoader
}

const initThree = async () => {
  if (initialized || activating) return
  activating = true

  try {
    ThreeModule = await getThree()
    clock = new ThreeModule.Clock()

    const el = container.value
    if (!el) throw new Error('CONTAINER_NOT_FOUND')

    const width = el.clientWidth || el.offsetWidth || 1
    const height = el.clientHeight || el.offsetHeight || 1

    renderer = new ThreeModule.WebGLRenderer({ antialias: true, alpha: true })
    renderer.outputColorSpace = ThreeModule.SRGBColorSpace
    renderer.toneMapping = ThreeModule.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    renderer.shadowMap.enabled = true
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height, false)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.outline = 'none'
    renderer.domElement.tabIndex = -1
    el.appendChild(renderer.domElement)

    scene = new ThreeModule.Scene()
    camera = new ThreeModule.PerspectiveCamera(45, width / height || 1, 0.1, 100)
    controls = new ThreeModule.OrbitControls(camera, renderer.domElement)

    const ambientLight = new ThreeModule.AmbientLight(0xffffff, 1.1)
    scene.add(ambientLight)
    const directionalLight = new ThreeModule.DirectionalLight(0xffffff, 1.4)
    directionalLight.position.set(4, 6, 3)
    directionalLight.castShadow = true
    scene.add(directionalLight)

    await loadModel()
    initialized = true
    startLoop()
    isReady.value = true
    emit('ready')
  } catch (error) {
    logger.error('初始化 Tjg 小管家失败', error)
    emit('error', error)
  } finally {
    activating = false
  }
}

const isInvalidBounds = (size: Vector3, center: Vector3) =>
  size.lengthSq() === 0 || !Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z)

const sanitizeFileName = (input: string) => input.replace(/[<>:"/\\|?*]+/g, '_')

const resolveModelSource = async () => {
  if (props.customModel) {
    currentCustomSource = props.customModel
    const presetMeta = assistantModelMetaMap.value?.[props.customModel]

    if (presetMeta) {
      const extensionMatch = props.customModel.match(/\.([a-z0-9]+)(?:[?#]|$)/i)
      const extension = extensionMatch ? extensionMatch[1] : 'glb'
      const fileLabel = `${presetMeta.name}(${presetMeta.version})`

      if (isRemoteSource(props.customModel) && isDesktop()) {
        try {
          const fileName = `${sanitizeFileName(fileLabel)}.${extension}`
          const cachedPath = await ensureModelFile(fileName, props.customModel)
          const localUrl = convertFileSrc(cachedPath)
          lastResolvedModelSource = localUrl
          return localUrl
        } catch (error) {
          logger.warn('缓存远程模型失败, 回退为在线加载', error)
        }
      }
    }

    if (isRemoteSource(props.customModel)) {
      lastResolvedModelSource = props.customModel
      return props.customModel
    }

    if (isDesktop()) {
      await invokeSilently('allow_asset_path', { path: props.customModel })
    }

    const localUrl = isDesktop() ? convertFileSrc(props.customModel) : props.customModel
    lastResolvedModelSource = localUrl
    return localUrl
  }

  currentCustomSource = null
  if (lastResolvedModelSource) {
    return lastResolvedModelSource
  }
  throw new Error('MODEL_SOURCE_NOT_AVAILABLE')
}

const updateRendererSize = () => {
  if (!renderer || !camera) return
  const el = container.value
  if (!el) return
  const width = el.clientWidth || el.offsetWidth || 1
  const height = el.clientHeight || el.offsetHeight || 1
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(width, height, false)
  camera.aspect = width / height || 1
  camera.updateProjectionMatrix()
}

const startLoop = () => {
  if (!scene || !camera || !renderer || !clock) return
  if (animationFrameId !== null) return

  const currentClock: Clock = clock
  currentClock.start()
  const currentScene = scene
  const currentCamera = camera
  const currentRenderer = renderer

  const loop = () => {
    animationFrameId = requestAnimationFrame(loop)
    const delta = currentClock.getDelta()
    mixer?.update(delta)
    controls?.update()
    currentRenderer.render(currentScene, currentCamera)
  }

  const el = container.value
  if (el) {
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        updateRendererSize()
      })
    }
    resizeObserver.observe(el)
  }
  window.addEventListener('resize', updateRendererSize, { passive: true })
  updateRendererSize()
  animationFrameId = requestAnimationFrame(loop)
}

const stopLoop = () => {
  const currentClock = clock
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  currentClock?.stop()
  const el = container.value
  if (el && resizeObserver) {
    resizeObserver.unobserve(el)
  }
  window.removeEventListener('resize', updateRendererSize)
}

const disposeResources = () => {
  stopLoop()
  controls?.dispose()
  controls = null

  if (scene) {
    scene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose?.())
        } else {
          mesh.material?.dispose?.()
        }
      }
    })
  }

  renderer?.dispose()
  renderer = null
  if (modelWrapper && scene) {
    scene.remove(modelWrapper)
  }
  modelWrapper = null
  scene = null
  camera = null
  model = null
  mixer?.stopAllAction()
  mixer = null
  activeAction = null
  availableClips = []
  initialized = false
  isReady.value = false
  loadingProgress.value = 0
}

const adjustFraming = (scaledSize: Vector3, centerY: number) => {
  if (!camera || !controls) return
  const maxAxis = Math.max(scaledSize.x, scaledSize.y, scaledSize.z) || 1
  const targetY = centerY - scaledSize.y * TARGET_OFFSET_RATIO
  controls.target.set(0, targetY, 0)
  controls.enableDamping = true
  controls.enablePan = false
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.8
  controls.minDistance = maxAxis * 0.7
  controls.maxDistance = maxAxis * 3
  const distance = maxAxis * CAMERA_DISTANCE_FACTOR
  camera.position.set(0, targetY + distance * CAMERA_HEIGHT_FACTOR, distance)
  camera.near = Math.max(distance / 100, 0.1)
  camera.far = distance * 10
  camera.lookAt(controls.target)
  camera.updateProjectionMatrix()
  controls.update()
}

const loadModel = async () => {
  if (!scene || !ThreeModule) {
    throw new Error('场景尚未初始化')
  }
  loadingProgress.value = 0
  isReady.value = false
  if (!modelWrapper) {
    modelWrapper = new ThreeModule.Group()
    scene.add(modelWrapper)
  }
  if (mixer) {
    mixer.stopAllAction()
    mixer = null
    activeAction = null
  }
  availableClips = []
  const modelSource = await resolveModelSource()
  const loader = new ThreeModule.GLTFLoader()
  loader.setDRACOLoader(await ensureDracoLoader())
  const result = await new Promise<{ scene: Group; extensions?: string[]; animations: AnimationClip[] }>(
    (resolve, reject) => {
      loader.load(
        modelSource,
        (gltf) => {
          resolve({
            scene: gltf.scene,
            extensions: gltf.parser.json?.extensionsUsed,
            animations: gltf.animations || []
          })
        },
        (event) => {
          const total = event.total || event.loaded
          if (total) {
            const percent = Math.round((event.loaded / total) * 100)
            loadingProgress.value = Math.max(loadingProgress.value, Math.min(percent, 99))
          }
        },
        (error) => {
          loadingProgress.value = 0
          logger.error('模型加载失败', modelSource, error)
          reject(error)
        }
      )
    }
  )

  const extensions = result.extensions ?? []
  if (
    currentCustomSource &&
    extensions.some((ext) => ['KHR_texture_basisu', 'EXT_meshopt_compression'].includes(ext))
  ) {
    showFeedback('暂不支持压缩后的 glb 模型，请选择原始模型文件', 'warning')
    throw new Error('UNSUPPORTED_COMPRESSED_MODEL')
  }

  const previousModel = model
  const loadedModel = result.scene
  const childrenSummary: Record<string, number> = {}
  loadedModel.traverse((child) => {
    const type = (child as Mesh).type
    childrenSummary[type] = (childrenSummary[type] || 0) + 1
  })
  const box = new ThreeModule.Box3().setFromObject(loadedModel)
  const size = box.getSize(new ThreeModule.Vector3())
  const center = box.getCenter(new ThreeModule.Vector3())
  const hasInvalidBounds = isInvalidBounds(size, center)
  if (hasInvalidBounds) {
    showFeedback('模型没有几何数据或存在损坏，请检查后重新导入', 'warning')
    throw new Error('EMPTY_MODEL_GEOMETRY')
  }
  const maxAxis = Math.max(size.x, size.y, size.z) || 1
  const scale = TARGET_SIZE / maxAxis
  const scaledSize = size.clone().multiplyScalar(scale)
  const lift = scaledSize.y * LIFT_RATIO
  const centerY = scaledSize.y / 2 + lift

  if (previousModel && modelWrapper) {
    modelWrapper.remove(previousModel)
    previousModel.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh
        mesh.geometry.dispose()
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose?.())
        } else {
          mesh.material?.dispose?.()
        }
      }
    })
  }

  model = loadedModel
  modelWrapper?.add(loadedModel)
  modelWrapper?.scale.setScalar(scale)
  const scaledCenter = center.clone().multiplyScalar(scale)
  if (modelWrapper) {
    modelWrapper.position.set(-scaledCenter.x, centerY - scaledCenter.y, -scaledCenter.z)
  }

  availableClips = result.animations
  if (availableClips.length > 0) {
    mixer = new ThreeModule.AnimationMixer(loadedModel)
    const preferred =
      ThreeModule.AnimationClip.findByName(availableClips, 'Animation') ||
      ThreeModule.AnimationClip.findByName(availableClips, 'Armature|mixamo.com|Layer0') ||
      availableClips[0]
    activeAction = mixer.clipAction(preferred)
    activeAction.reset().play()
  } else {
    logger.debug('模型没有动画片段')
  }
  adjustFraming(scaledSize, centerY)
  loadingProgress.value = 100
  isReady.value = true
}

const deactivate = () => {
  stopLoop()
}

watch(
  () => props.active,
  (active) => {
    if (active) {
      void initThree()
    } else {
      deactivate()
    }
  },
  { immediate: true }
)

watch(
  () => props.customModel,
  async () => {
    if (!props.active) return
    if (!scene) {
      await initThree()
      return
    }
    await loadModel()
    isReady.value = true
    if (animationFrameId === null) {
      startLoop()
    }
    emit('ready')
  }
)

onMounted(() => {
  if (props.active) {
    void initThree()
  }
})

onUnmounted(() => {
  disposeResources()
})
</script>

<style scoped lang="scss">
.assistant-view {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 16px;
  border-radius: 16px;
  background: radial-gradient(
    ellipse at center,
    color-mix(in srgb, var(--tjg-color-primary-500) 24%, transparent),
    transparent
  );
  box-shadow: inset 0 0 0 1px var(--tjg-color-primary-400);
  overflow: hidden;

  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
}

.assistant-view__placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-size: 14px;
  color: var(--tjg-color-primary-500);
  background: color-mix(in srgb, var(--tjg-surface-panel) 12%, transparent);
  backdrop-filter: blur(8px);
}

.assistant-view__progress {
  width: 40%;
  min-width: 180px;
}

.assistant-view__placeholder-text {
  padding-top: 12px;
  font-size: 14px;
  color: var(--tjg-text-primary);
}
</style>
