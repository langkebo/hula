import { defineComponent, h } from 'vue'

export default defineComponent({
  name: 'StorybookMemberListStub',
  props: {
    members: {
      type: Array,
      default: () => []
    }
  },
  emits: ['member-click'],
  setup(props, { emit }) {
    return () =>
      h(
        'div',
        { 'data-test': 'storybook-member-list' },
        (props.members as Array<{ userId: string; displayName?: string }>).map((member) =>
          h(
            'button',
            {
              key: member.userId,
              type: 'button',
              onClick: () => emit('member-click', member)
            },
            member.displayName || member.userId
          )
        )
      )
  }
})
