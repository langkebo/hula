import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RobotCard, { type RobotCardData } from '@/plugins/robot/components/RobotCard.vue'

const baseRobot: RobotCardData = {
  id: 'r1',
  name: '小助手',
  model: 'gpt-4o',
  online: true,
  messageCount: 12,
  time: '10:30'
}

describe('RobotCard', () => {
  it('renders name, model, message count and time', () => {
    const wrapper = mount(RobotCard, { props: { robot: baseRobot } })
    expect(wrapper.find('[data-testid="robot-card-name"]').text()).toBe('小助手')
    expect(wrapper.find('[data-testid="robot-card-model"]').text()).toBe('gpt-4o')
    expect(wrapper.find('[data-testid="robot-card-message-count"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="robot-card-time"]').text()).toBe('10:30')
  })

  it('renders avatar image when avatar provided, placeholder otherwise', () => {
    const withAvatar = mount(RobotCard, { props: { robot: { ...baseRobot, avatar: 'https://x.test/a.png' } } })
    expect(withAvatar.find('[data-testid="robot-card-avatar-img"]').exists()).toBe(true)
    expect(withAvatar.find('[data-testid="robot-card-avatar-placeholder"]').exists()).toBe(false)

    const withoutAvatar = mount(RobotCard, { props: { robot: baseRobot } })
    expect(withoutAvatar.find('[data-testid="robot-card-avatar-placeholder"]').text()).toBe('小')
    expect(withoutAvatar.find('[data-testid="robot-card-avatar-img"]').exists()).toBe(false)
  })

  it('shows online / offline status dot according to robot.online', () => {
    const online = mount(RobotCard, { props: { robot: baseRobot } })
    expect(online.find('[data-testid="robot-card-status-online"]').exists()).toBe(true)
    expect(online.find('[data-testid="robot-card-status-offline"]').exists()).toBe(false)

    const offline = mount(RobotCard, { props: { robot: { ...baseRobot, online: false } } })
    expect(offline.find('[data-testid="robot-card-status-offline"]').exists()).toBe(true)

    const unknown = mount(RobotCard, { props: { robot: { ...baseRobot, online: undefined } } })
    expect(unknown.find('[data-testid="robot-card-status-online"]').exists()).toBe(false)
    expect(unknown.find('[data-testid="robot-card-status-offline"]').exists()).toBe(false)
  })

  it('applies active class when active prop is true', () => {
    const wrapper = mount(RobotCard, { props: { robot: baseRobot, active: true } })
    expect(wrapper.find('[data-testid="robot-card"]').classes()).toContain('robot-card--active')
  })

  it('emits click with robot payload on click and Enter key', async () => {
    const wrapper = mount(RobotCard, { props: { robot: baseRobot } })
    await wrapper.find('[data-testid="robot-card"]').trigger('click')
    expect(wrapper.emitted('click')).toBeTruthy()
    expect(wrapper.emitted('click')![0]).toEqual([baseRobot])

    await wrapper.find('[data-testid="robot-card"]').trigger('keydown.enter')
    expect(wrapper.emitted('click')!.length).toBe(2)
  })

  it('hides model tag and meta row when fields are absent', () => {
    const wrapper = mount(RobotCard, { props: { robot: { id: 'r2', name: 'bot' } } })
    expect(wrapper.find('[data-testid="robot-card-model"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="robot-card-message-count"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="robot-card-time"]').exists()).toBe(false)
  })
})
