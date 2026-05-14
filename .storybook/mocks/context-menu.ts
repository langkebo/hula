import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'StorybookContextMenuStub',
  setup(_, { slots }) {
    return () => h('div', { 'data-test': 'storybook-context-menu' }, slots.default?.())
  }
})
