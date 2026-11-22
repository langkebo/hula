/** 成员关系变更动作的展示元数据（成员变更历史与最近成员变更共用）。 */

type MembershipActionTone = 'positive' | 'negative' | 'warning' | 'neutral' | 'info'

const ACTION_LABEL_KEYS: Record<string, string> = {
  join: 'room.settings_drawer.membership_action_join',
  leave: 'room.settings_drawer.membership_action_leave',
  invite: 'room.settings_drawer.membership_action_invite',
  ban: 'room.settings_drawer.membership_action_ban',
  knock: 'room.settings_drawer.membership_action_knock'
}

const ACTION_TONES: Record<string, MembershipActionTone> = {
  join: 'positive',
  leave: 'neutral',
  invite: 'info',
  ban: 'negative',
  knock: 'warning'
}

/** 已知动作返回 i18n key，未知动作返回 undefined（由调用方原样展示动作码）。 */
export const membershipActionLabelKey = (membership: string): string | undefined => ACTION_LABEL_KEYS[membership]

/** 未知动作按中性色处理。 */
export const membershipActionTone = (membership: string): MembershipActionTone => ACTION_TONES[membership] ?? 'neutral'
