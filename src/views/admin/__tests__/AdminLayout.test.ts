import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AdminApiAvailability, AdminApiAvailabilityStatus } from '@/services/matrix/admin/adminApiAvailability'
import AdminLayout from '../AdminLayout.vue'

interface TestAdminState {
  apiAvailability: AdminApiAvailability | null
  availabilityLoaded: boolean
  isCheckingAdmin: boolean
  isAdmin: boolean
  retryApiProbe: () => void
}

interface TestCapabilityState {
  unstableFeatures: Record<string, boolean>
}

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  retryApiProbe: vi.fn(),
  adminState: null as unknown,
  capabilityState: null as unknown
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ path: '/admin/users' }),
  useRouter: () => ({ push: mocks.push })
}))

vi.mock('@/stores/domains/admin/admin', async () => {
  const { reactive } = await import('vue')
  const state = reactive<TestAdminState>({
    apiAvailability: null,
    availabilityLoaded: false,
    isCheckingAdmin: false,
    isAdmin: true,
    retryApiProbe: mocks.retryApiProbe
  })
  mocks.adminState = state
  return { useAdminStore: () => state }
})

vi.mock('@/stores/domains/chat/capability', async () => {
  const { reactive } = await import('vue')
  const state = reactive<TestCapabilityState>({ unstableFeatures: {} })
  mocks.capabilityState = state
  return { useCapabilityStore: () => state }
})

function adminState(): TestAdminState {
  return mocks.adminState as TestAdminState
}

function capabilityState(): TestCapabilityState {
  return mocks.capabilityState as TestCapabilityState
}

function availability(status: AdminApiAvailabilityStatus): AdminApiAvailability {
  return {
    status,
    statusCode: null,
    errorCode: null,
    apiPresent: null,
    authorized: status === 'available'
  }
}

function setProbe(status: AdminApiAvailabilityStatus, loaded = true) {
  adminState().apiAvailability = availability(status)
  adminState().availabilityLoaded = loaded
}

function mountLayout() {
  return mount(AdminLayout, {
    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a class="router-link-stub" :href="to"><slot /></a>'
        },
        RouterView: { template: '<div class="router-view-stub" />' },
        NTag: { template: '<span class="n-tag-stub"><slot /></span>' }
      }
    }
  })
}

describe('AdminLayout 导航五态', () => {
  beforeEach(() => {
    mocks.push.mockClear()
    mocks.retryApiProbe.mockClear()
    adminState().apiAvailability = null
    adminState().availabilityLoaded = false
    adminState().isCheckingAdmin = false
    adminState().isAdmin = true
    capabilityState().unstableFeatures = {}
  })

  it('探测完成前展示骨架与加载态，不渲染菜单', () => {
    const wrapper = mountLayout()

    expect(wrapper.findAll('.admin-nav-item')).toHaveLength(0)
    expect(wrapper.find('.admin-nav-skeleton').exists()).toBe(true)
    expect(wrapper.find('.admin-state-panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('admin.availability.loading.title')
    expect(wrapper.find('.router-view-stub').exists()).toBe(false)
  })

  it('Admin API 可用时渲染菜单与路由内容', () => {
    setProbe('available')

    const wrapper = mountLayout()

    expect(wrapper.findAll('.admin-nav-item').length).toBeGreaterThan(0)
    expect(wrapper.find('.admin-nav-skeleton').exists()).toBe(false)
    expect(wrapper.find('.admin-state-panel').exists()).toBe(false)
    expect(wrapper.find('.router-view-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain('admin.nav.users')
    expect(wrapper.text()).toContain('admin.status.admin')
  })

  it('forbidden 时隐藏全部菜单并给出无权限说明', () => {
    setProbe('forbidden')

    const wrapper = mountLayout()

    expect(wrapper.findAll('.admin-nav-item')).toHaveLength(0)
    expect(wrapper.find('.admin-nav-skeleton').exists()).toBe(false)
    expect(wrapper.find('.admin-nav-state-title').text()).toBe('admin.availability.forbidden.title')
    expect(wrapper.text()).toContain('admin.availability.forbidden.description')
    expect(wrapper.find('.admin-nav-retry').exists()).toBe(false)
    expect(wrapper.find('.router-view-stub').exists()).toBe(false)
  })

  it('unauthorized 时隐藏全部菜单并提示凭证失效', () => {
    setProbe('unauthorized')

    const wrapper = mountLayout()

    expect(wrapper.findAll('.admin-nav-item')).toHaveLength(0)
    expect(wrapper.find('.admin-nav-state-title').text()).toBe('admin.availability.unauthorized.title')
    expect(wrapper.text()).toContain('admin.availability.tag.unauthorized')
  })

  it('unsupported 时隐藏全部菜单并说明能力未启用', () => {
    setProbe('unsupported')

    const wrapper = mountLayout()

    expect(wrapper.findAll('.admin-nav-item')).toHaveLength(0)
    expect(wrapper.find('.admin-nav-state-title').text()).toBe('admin.availability.unsupported.title')
    expect(wrapper.text()).toContain('admin.availability.tag.unsupported')
    expect(wrapper.find('.admin-nav-retry').exists()).toBe(false)
  })

  it('unavailable 时展示骨架并提供重试入口', async () => {
    setProbe('unavailable')

    const wrapper = mountLayout()

    expect(wrapper.findAll('.admin-nav-item')).toHaveLength(0)
    expect(wrapper.find('.admin-nav-skeleton').exists()).toBe(true)

    const retry = wrapper.find('.admin-nav-retry')
    expect(retry.exists()).toBe(true)

    await retry.trigger('click')

    expect(mocks.retryApiProbe).toHaveBeenCalledTimes(1)
  })

  it('重试进行中时禁用重试按钮', () => {
    setProbe('unavailable')
    adminState().isCheckingAdmin = true

    const wrapper = mountLayout()

    const retry = wrapper.find('.admin-nav-retry')
    expect(retry.attributes('disabled')).toBeDefined()
    expect(retry.text()).toBe('admin.availability.retrying')
  })

  it('可选能力被服务端明确关闭时剔除对应菜单项', () => {
    setProbe('available')
    capabilityState().unstableFeatures = { 'io.hula.saml': false }

    const wrapper = mountLayout()

    const paths = wrapper.findAll('.admin-nav-item').map((item) => item.attributes('href'))
    expect(paths).not.toContain('/admin/saml')
    expect(paths).toContain('/admin/modules')
  })

  it('可选能力未发布时保留菜单项', () => {
    setProbe('available')

    const wrapper = mountLayout()

    const paths = wrapper.findAll('.admin-nav-item').map((item) => item.attributes('href'))
    expect(paths).toContain('/admin/saml')
    expect(paths).toContain('/admin/modules')
  })

  it('点击返回应用按钮跳转 /message', async () => {
    const wrapper = mountLayout()

    await wrapper.find('.admin-back-btn').trigger('click')

    expect(mocks.push).toHaveBeenCalledWith('/message')
  })
})
