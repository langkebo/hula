import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import RoomHomeserverLabel from '../RoomHomeserverLabel.vue'

describe('RoomHomeserverLabel', () => {
  it('renders explicit serverName prop', () => {
    const wrapper = mount(RoomHomeserverLabel, {
      props: { serverName: 'matrix.org' }
    })
    expect(wrapper.text()).toBe('matrix.org')
    expect(wrapper.attributes('title')).toBe('matrix.org')
  })

  it('renders roomId-derived server name', () => {
    const wrapper = mount(RoomHomeserverLabel, {
      props: { roomId: '!abc123:matrix.org' }
    })
    expect(wrapper.text()).toBe('matrix.org')
  })

  it('shows empty when neither prop is provided', () => {
    const wrapper = mount(RoomHomeserverLabel)
    expect(wrapper.text()).toBe('')
  })
})
