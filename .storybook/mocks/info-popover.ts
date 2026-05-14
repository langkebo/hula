import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'StorybookInfoPopoverStub',
  props: {
    uid: {
      type: String,
      default: ''
    }
  },
  setup(props) {
    return () => h('div', { 'data-test': 'storybook-info-popover' }, props.uid)
  }
})
