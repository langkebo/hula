import { describe, expect, it } from 'vitest'
import {
  ActEnum,
  AiMsgContentTypeEnum,
  CallTypeEnum,
  ChangeTypeEnum,
  CloseBxEnum,
  EventEnum,
  IsYesEnum,
  LimitEnum,
  MacOsKeyEnum,
  MarkEnum,
  MergeMessageType,
  MessageStatusEnum,
  MittEnum,
  MobilePanelStateEnum,
  ModalEnum,
  MsgEnum,
  NotificationTypeEnum,
  OnlineEnum,
  PluginEnum,
  PowerEnum,
  RoleEnum,
  RoomActEnum,
  RoomTypeEnum,
  RTCCallStatus,
  ScrollIntentEnum,
  SessionOperateEnum,
  SexEnum,
  ShowModeEnum,
  StoresEnum,
  TauriCommand,
  ThemeEnum,
  TriggerEnum,
  UploadSceneEnum,
  UserType,
  WinKeyEnum,
  WsResponseMessageType
} from '../index'

/**
 * 校验数字枚举内值唯一
 */
function expectUniqueNumericValues(enumObj: Record<string, number | string>, enumName: string) {
  const numericEntries = Object.entries(enumObj).filter(([, value]) => typeof value === 'number')
  const values = numericEntries.map(([, value]) => value as number)
  const duplicates = values.filter((v, i) => values.indexOf(v) !== i)
  expect(duplicates, `${enumName} 中存在重复的数字值: ${duplicates.join(', ')}`).toEqual([])
}

/**
 * 校验字符串枚举内值唯一
 */
function expectUniqueStringValues(enumObj: Record<string, number | string>, enumName: string) {
  const stringEntries = Object.entries(enumObj).filter(([, value]) => typeof value === 'string')
  const values = stringEntries.map(([, value]) => value as string)
  const duplicates = values.filter((v, i) => values.indexOf(v) !== i)
  expect(duplicates, `${enumName} 中存在重复的字符串值: ${duplicates.join(', ')}`).toEqual([])
}

describe('enums/index.ts', () => {
  describe('WsResponseMessageType', () => {
    it('所有枚举值存在', () => {
      expect(WsResponseMessageType.NO_INTERNET).toBe('noInternet')
      expect(WsResponseMessageType.LOGIN_SUCCESS).toBe('loginSuccess')
      expect(WsResponseMessageType.RECEIVE_MESSAGE).toBe('receiveMessage')
      expect(WsResponseMessageType.ONLINE).toBe('online')
      expect(WsResponseMessageType.TOKEN_EXPIRED).toBe('tokenExpired')
      expect(WsResponseMessageType.INVALID_USER).toBe('invalidUser')
      expect(WsResponseMessageType.MSG_MARK_ITEM).toBe('msgMarkItem')
      expect(WsResponseMessageType.MSG_RECALL).toBe('msgRecall')
      expect(WsResponseMessageType.REQUEST_NEW_FRIEND).toBe('requestNewFriend')
      expect(WsResponseMessageType.WS_MEMBER_CHANGE).toBe('ws-member-change')
      expect(WsResponseMessageType.GROUP_SET_ADMIN_SUCCESS).toBe('groupSetAdmin')
      expect(WsResponseMessageType.OFFLINE).toBe('offline')
      expect(WsResponseMessageType.REQUEST_APPROVAL_FRIEND).toBe('requestApprovalFriend')
      expect(WsResponseMessageType.NOTIFY_EVENT).toBe('notifyEvent')
      expect(WsResponseMessageType.USER_STATE_CHANGE).toBe('userStateChange')
      expect(WsResponseMessageType.ROOM_INFO_CHANGE).toBe('roomInfoChange')
      expect(WsResponseMessageType.MY_ROOM_INFO_CHANGE).toBe('myRoomInfoChange')
      expect(WsResponseMessageType.ROOM_DISSOLUTION).toBe('roomDissolution')
      expect(WsResponseMessageType.ROOM_GROUP_NOTICE_MSG).toBe('roomGroupNoticeMsg')
      expect(WsResponseMessageType.ROOM_EDIT_GROUP_NOTICE_MSG).toBe('roomEditGroupNoticeMsg')
      expect(WsResponseMessageType.VideoCallRequest).toBe('VideoCallRequest')
    })

    it('字符串值唯一', () => {
      expectUniqueStringValues(
        WsResponseMessageType as unknown as Record<string, number | string>,
        'WsResponseMessageType'
      )
    })
  })

  describe('EventEnum', () => {
    it('关键值正确', () => {
      expect(EventEnum.WIN_CLOSE).toBe('winClose')
      expect(EventEnum.EXIT).toBe('exit')
      expect(EventEnum.LOGOUT).toBe('logout')
      expect(EventEnum.ALONE).toBe('alone')
      expect(EventEnum.LOCK_SCREEN).toBe('lockScreen')
      expect(EventEnum.MULTI_MSG).toBe('multiMsg')
    })

    it('字符串值唯一', () => {
      expectUniqueStringValues(EventEnum as unknown as Record<string, number | string>, 'EventEnum')
    })
  })

  describe('MittEnum', () => {
    it('关键值正确', () => {
      expect(MittEnum.UPDATE_MSG_TOTAL).toBe('updateMsgTotal')
      expect(MittEnum.MSG_BOX_SHOW).toBe('msgBoxShow')
      expect(MittEnum.TO_SEND_MSG).toBe('toSendMsg')
      expect(MittEnum.SHRINK_WINDOW).toBe('windowShrink')
      expect(MittEnum.AT).toBe('at')
      expect(MittEnum.DELETE_SESSION).toBe('deleteSession')
      expect(MittEnum.OPEN_THREAD).toBe('openThread')
      expect(MittEnum.AI_STOP_STREAMING).toBe('ai_stop_streaming')
      expect(MittEnum.OPEN_ANNOUNCEMENT_PANEL).toBe('openAnnouncementPanel')
      expect(MittEnum.WIDGET_CREATED).toBe('widgetCreated')
      expect(MittEnum.WIDGET_DELETED).toBe('widgetDeleted')
      expect(MittEnum.BURN_MESSAGE_READ).toBe('burnMessageRead')
      expect(MittEnum.BURN_MESSAGE_BURNED).toBe('burnMessageBurned')
    })

    it('字符串值唯一', () => {
      expectUniqueStringValues(MittEnum as unknown as Record<string, number | string>, 'MittEnum')
    })
  })

  describe('ThemeEnum', () => {
    it('值正确', () => {
      expect(ThemeEnum.LIGHT).toBe('light')
      expect(ThemeEnum.DARK).toBe('dark')
      expect(ThemeEnum.OS).toBe('os')
    })

    it('字符串值唯一', () => {
      expectUniqueStringValues(ThemeEnum as unknown as Record<string, number | string>, 'ThemeEnum')
    })
  })

  describe('StoresEnum', () => {
    it('关键值正确', () => {
      expect(StoresEnum.ALWAYS_ON_TOP).toBe('alwaysOnTop')
      expect(StoresEnum.SETTING).toBe('setting')
      expect(StoresEnum.HISTORY).toBe('history')
      expect(StoresEnum.PLUGINS).toBe('plugins')
      expect(StoresEnum.MENUTOP).toBe('menuTop')
      expect(StoresEnum.LOGIN_HISTORY).toBe('loginHistory')
      expect(StoresEnum.GROUP).toBe('group')
      expect(StoresEnum.ANNOUNCEMENT).toBe('announcement')
      expect(StoresEnum.MESSAGE).toBe('message')
      expect(StoresEnum.SESSION_UNREAD).toBe('sessionUnread')
      expect(StoresEnum.MATRIX).toBe('matrix')
      expect(StoresEnum.ROOM).toBe('room')
      expect(StoresEnum.BADGE).toBe('badge')
      expect(StoresEnum.QUOTA).toBe('quota')
      expect(StoresEnum.MODERATION).toBe('moderation')
      expect(StoresEnum.CAPABILITY).toBe('capability')
      expect(StoresEnum.ENCRYPTION).toBe('encryption')
    })

    it('字符串值唯一', () => {
      expectUniqueStringValues(StoresEnum as unknown as Record<string, number | string>, 'StoresEnum')
    })
  })

  describe('MsgEnum', () => {
    it('数值连续递增', () => {
      expect(MsgEnum.UNKNOWN).toBe(0)
      expect(MsgEnum.TEXT).toBe(1)
      expect(MsgEnum.RECALL).toBe(2)
      expect(MsgEnum.IMAGE).toBe(3)
      expect(MsgEnum.FILE).toBe(4)
      expect(MsgEnum.VOICE).toBe(5)
      expect(MsgEnum.VIDEO).toBe(6)
      expect(MsgEnum.EMOJI).toBe(7)
      expect(MsgEnum.SYSTEM).toBe(8)
      expect(MsgEnum.MERGE).toBe(9)
      expect(MsgEnum.LOCATION).toBe(10)
      expect(MsgEnum.AUDIO_CALL).toBe(11)
      expect(MsgEnum.VIDEO_CALL).toBe(12)
      expect(MsgEnum.NOTICE).toBe(13)
      expect(MsgEnum.BOT).toBe(14)
      expect(MsgEnum.LINK_PREVIEW).toBe(15)
      expect(MsgEnum.BEACON).toBe(16)
      expect(MsgEnum.MIXED).toBe(17)
      expect(MsgEnum.AIT).toBe(18)
      expect(MsgEnum.REPLY).toBe(19)
      expect(MsgEnum.AI).toBe(20)
      expect(MsgEnum.AUDIO).toBe(21)
    })

    it('关键命名成员可访问', () => {
      expect(MsgEnum.AIT).toBe(18)
      expect(MsgEnum.AUDIO).toBe(21)
      expect(MsgEnum.AUDIO_CALL).toBe(11)
      expect(MsgEnum.BEACON).toBe(16)
      expect(MsgEnum.LINK_PREVIEW).toBe(15)
    })

    it('数字值唯一', () => {
      expectUniqueNumericValues(MsgEnum as unknown as Record<string, number | string>, 'MsgEnum')
    })
  })

  describe('AiMsgContentTypeEnum', () => {
    it('值正确', () => {
      expect(AiMsgContentTypeEnum.TEXT).toBe(1)
      expect(AiMsgContentTypeEnum.IMAGE).toBe(2)
      expect(AiMsgContentTypeEnum.VIDEO).toBe(3)
      expect(AiMsgContentTypeEnum.AUDIO).toBe(4)
    })

    it('数字值唯一', () => {
      expectUniqueNumericValues(
        AiMsgContentTypeEnum as unknown as Record<string, number | string>,
        'AiMsgContentTypeEnum'
      )
    })
  })

  describe('OnlineEnum', () => {
    it('值正确', () => {
      expect(OnlineEnum.ONLINE).toBe(1)
      expect(OnlineEnum.OFFLINE).toBe(2)
    })
    it('数字值唯一', () => {
      expectUniqueNumericValues(OnlineEnum as unknown as Record<string, number | string>, 'OnlineEnum')
    })
  })

  describe('ActEnum', () => {
    it('值正确', () => {
      expect(ActEnum.Confirm).toBe(1)
      expect(ActEnum.Cancel).toBe(2)
    })
    it('数字值唯一', () => {
      expectUniqueNumericValues(ActEnum as unknown as Record<string, number | string>, 'ActEnum')
    })
  })

  describe('SexEnum', () => {
    it('值正确', () => {
      expect(SexEnum.MAN).toBe(1)
      expect(SexEnum.REMALE).toBe(2)
    })
    it('数字值唯一', () => {
      expectUniqueNumericValues(SexEnum as unknown as Record<string, number | string>, 'SexEnum')
    })
  })

  describe('PowerEnum', () => {
    it('值正确（仅 ADMIN，默认从 0 开始）', () => {
      expect(PowerEnum.ADMIN).toBe(0)
    })
  })

  describe('IsYesEnum', () => {
    it('值正确', () => {
      expect(IsYesEnum.NO).toBe(0)
      expect(IsYesEnum.YES).toBe(1)
    })
  })

  describe('MarkEnum', () => {
    it('值正确', () => {
      expect(MarkEnum.LIKE).toBe(1)
      expect(MarkEnum.DISLIKE).toBe(2)
      expect(MarkEnum.HEART).toBe(3)
      expect(MarkEnum.ANGRY).toBe(4)
      expect(MarkEnum.LIGHT).toBe(13)
      expect(MarkEnum.MONEY).toBe(14)
    })
    it('数字值唯一', () => {
      expectUniqueNumericValues(MarkEnum as unknown as Record<string, number | string>, 'MarkEnum')
    })
  })

  describe('RoleEnum', () => {
    it('值正确', () => {
      expect(RoleEnum.LORD).toBe(1)
      expect(RoleEnum.ADMIN).toBe(2)
      expect(RoleEnum.NORMAL).toBe(3)
    })
    it('数字值唯一', () => {
      expectUniqueNumericValues(RoleEnum as unknown as Record<string, number | string>, 'RoleEnum')
    })
  })

  describe('RoomTypeEnum', () => {
    it('值正确', () => {
      expect(RoomTypeEnum.GROUP).toBe(1)
      expect(RoomTypeEnum.SINGLE).toBe(2)
      expect(RoomTypeEnum.SPACE).toBe(3)
    })
  })

  describe('RoomActEnum', () => {
    it('值正确', () => {
      expect(RoomActEnum.EXIT_GROUP).toBe(0)
      expect(RoomActEnum.DISSOLUTION_GROUP).toBe(1)
      expect(RoomActEnum.DELETE_FRIEND).toBe(2)
      expect(RoomActEnum.DELETE_RECORD).toBe(3)
      expect(RoomActEnum.BLOCK_FRIEND).toBe(4)
      expect(RoomActEnum.UPDATE_GROUP_NAME).toBe(5)
      expect(RoomActEnum.UPDATE_GROUP_INFO).toBe(6)
    })
    it('数字值唯一', () => {
      expectUniqueNumericValues(RoomActEnum as unknown as Record<string, number | string>, 'RoomActEnum')
    })
  })

  describe('ChangeTypeEnum', () => {
    it('值正确', () => {
      expect(ChangeTypeEnum.JOIN).toBe(1)
      expect(ChangeTypeEnum.REMOVE).toBe(2)
      expect(ChangeTypeEnum.EXIT_GROUP).toBe(3)
    })
  })

  describe('CloseBxEnum', () => {
    it('值正确', () => {
      expect(CloseBxEnum.HIDE).toBe('hide')
      expect(CloseBxEnum.CLOSE).toBe('close')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(CloseBxEnum as unknown as Record<string, number | string>, 'CloseBxEnum')
    })
  })

  describe('LimitEnum', () => {
    it('值正确', () => {
      expect(LimitEnum.COM_COUNT).toBe(5)
    })
  })

  describe('ModalEnum', () => {
    it('值正确', () => {
      expect(ModalEnum.LOCK_SCREEN).toBe(0)
      expect(ModalEnum.CHECK_UPDATE).toBe(1)
    })
  })

  describe('MacOsKeyEnum', () => {
    it('值正确', () => {
      expect(MacOsKeyEnum['⌘']).toBe('⌘')
      expect(MacOsKeyEnum['⇧']).toBe('⇧')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(MacOsKeyEnum as unknown as Record<string, number | string>, 'MacOsKeyEnum')
    })
  })

  describe('WinKeyEnum', () => {
    it('值正确', () => {
      expect(WinKeyEnum.CTRL).toBe('Ctrl')
      expect(WinKeyEnum.SHIFT).toBe('Shift')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(WinKeyEnum as unknown as Record<string, number | string>, 'WinKeyEnum')
    })
  })

  describe('PluginEnum', () => {
    it('值正确', () => {
      expect(PluginEnum.BUILTIN).toBe(0)
      expect(PluginEnum.INSTALLED).toBe(1)
      expect(PluginEnum.DOWNLOADING).toBe(2)
      expect(PluginEnum.NOT_INSTALLED).toBe(3)
      expect(PluginEnum.UNINSTALLING).toBe(4)
      expect(PluginEnum.CAN_UPDATE).toBe(5)
    })
    it('数字值唯一', () => {
      expectUniqueNumericValues(PluginEnum as unknown as Record<string, number | string>, 'PluginEnum')
    })
  })

  describe('ShowModeEnum', () => {
    it('值正确', () => {
      expect(ShowModeEnum.ICON).toBe(0)
      expect(ShowModeEnum.TEXT).toBe(1)
    })
  })

  describe('MessageStatusEnum', () => {
    it('值正确', () => {
      expect(MessageStatusEnum.PENDING).toBe('pending')
      expect(MessageStatusEnum.SENDING).toBe('sending')
      expect(MessageStatusEnum.SUCCESS).toBe('success')
      expect(MessageStatusEnum.FAILED).toBe('failed')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(MessageStatusEnum as unknown as Record<string, number | string>, 'MessageStatusEnum')
    })
  })

  describe('TriggerEnum', () => {
    it('值正确', () => {
      expect(TriggerEnum.MENTION).toBe('@')
      expect(TriggerEnum.AI).toBe('/')
      expect(TriggerEnum.TOPIC).toBe('#')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(TriggerEnum as unknown as Record<string, number | string>, 'TriggerEnum')
    })
  })

  describe('UploadSceneEnum', () => {
    it('值正确', () => {
      expect(UploadSceneEnum.CHAT).toBe('chat')
      expect(UploadSceneEnum.EMOJI).toBe('emoji')
      expect(UploadSceneEnum.AVATAR).toBe('avatar')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(UploadSceneEnum as unknown as Record<string, number | string>, 'UploadSceneEnum')
    })
  })

  describe('MobilePanelStateEnum', () => {
    it('值正确', () => {
      expect(MobilePanelStateEnum.NONE).toBe('none')
      expect(MobilePanelStateEnum.EMOJI).toBe('emoji')
      expect(MobilePanelStateEnum.VOICE).toBe('voice')
      expect(MobilePanelStateEnum.MORE).toBe('more')
      expect(MobilePanelStateEnum.FOCUS).toBe('focus')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(
        MobilePanelStateEnum as unknown as Record<string, number | string>,
        'MobilePanelStateEnum'
      )
    })
  })

  describe('SessionOperateEnum', () => {
    it('值正确（EXIT_GROUP 使用按位或结果 3）', () => {
      expect(SessionOperateEnum.DELETE_FRIEND).toBe(0)
      expect(SessionOperateEnum.DISSOLUTION_GROUP).toBe(1)
      expect(SessionOperateEnum.EXIT_GROUP).toBe(2 | 3)
      expect(SessionOperateEnum.EXIT_GROUP).toBe(3)
    })
    it('数字值唯一', () => {
      expectUniqueNumericValues(SessionOperateEnum as unknown as Record<string, number | string>, 'SessionOperateEnum')
    })
  })

  describe('NotificationTypeEnum', () => {
    it('值正确', () => {
      expect(NotificationTypeEnum.RECEPTION).toBe(0)
      expect(NotificationTypeEnum.NOT_DISTURB).toBe(1)
    })
  })

  describe('TauriCommand', () => {
    it('关键值正确', () => {
      expect(TauriCommand.SAVE_USER_INFO).toBe('save_user_info')
      expect(TauriCommand.SAVE_MSG).toBe('save_msg')
      expect(TauriCommand.DELETE_MESSAGE).toBe('delete_message')
      expect(TauriCommand.GET_USER_TOKENS).toBe('get_user_tokens')
      expect(TauriCommand.UPDATE_TOKEN).toBe('update_token')
      expect(TauriCommand.REMOVE_TOKENS).toBe('remove_tokens')
      expect(TauriCommand.QUERY_CHAT_HISTORY).toBe('query_chat_history')
      expect(TauriCommand.UPLOAD_FILE_PUT).toBe('upload_file_put')
      expect(TauriCommand.CHECK_ADMIN_STATUS).toBe('check_admin_status')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(TauriCommand as unknown as Record<string, number | string>, 'TauriCommand')
    })
  })

  describe('RTCCallStatus', () => {
    it('值正确', () => {
      expect(RTCCallStatus.CALLING).toBe(1)
      expect(RTCCallStatus.ACCEPT).toBe(2)
      expect(RTCCallStatus.END).toBe(3)
      expect(RTCCallStatus.REJECT).toBe(4)
      expect(RTCCallStatus.ERROR).toBe(5)
      expect(RTCCallStatus.BUSY).toBe(6)
      expect(RTCCallStatus.CANCEL).toBe(7)
    })
    it('数字值唯一', () => {
      expectUniqueNumericValues(RTCCallStatus as unknown as Record<string, number | string>, 'RTCCallStatus')
    })
  })

  describe('CallTypeEnum', () => {
    it('值正确', () => {
      expect(CallTypeEnum.AUDIO).toBe(1)
      expect(CallTypeEnum.VIDEO).toBe(2)
    })
  })

  describe('ScrollIntentEnum', () => {
    it('值正确', () => {
      expect(ScrollIntentEnum.NONE).toBe('none')
      expect(ScrollIntentEnum.INITIAL).toBe('initial')
      expect(ScrollIntentEnum.NEW_MESSAGE).toBe('new_message')
      expect(ScrollIntentEnum.LOAD_MORE).toBe('load_more')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(ScrollIntentEnum as unknown as Record<string, number | string>, 'ScrollIntentEnum')
    })
  })

  describe('MergeMessageType', () => {
    it('值正确', () => {
      expect(MergeMessageType.SINGLE).toBe(1)
    })
  })

  describe('UserType', () => {
    it('值正确', () => {
      expect(UserType.BOT).toBe('bot')
    })
    it('字符串值唯一', () => {
      expectUniqueStringValues(UserType as unknown as Record<string, number | string>, 'UserType')
    })
  })
})
