# Task 2.2 + 2.3 Report: Remove MatrixRoomService Facade

## Summary

Removed the `MatrixRoomService` facade (424 lines) that was a pass-through delegating to 7 sub-services. All 14 consumer files now import and call the real sub-services directly. The facade file and its 2 test files were deleted.

## Files Deleted

- `src/services/matrix/room/MatrixRoomService.ts` (facade, 424 lines)
- `src/services/matrix/room/__tests__/MatrixRoomService.test.ts`
- `src/services/matrix/room/__tests__/MatrixRoomExtendedService.test.ts`

## Files Modified

### Consumer files (14) - imports changed to sub-services:

| File | Sub-services Used |
|---|---|
| `src/stores/domains/chat/room.ts` | ActionFacade, CreationService, ReadFacade, RealtimeService |
| `src/stores/domains/chat/group.ts` | ActionFacade, QueryFacade, MemberFacade |
| `src/stores/domains/robot/center.ts` | QueryFacade |
| `src/components/room/InviteDialog.vue` | ActionFacade |
| `src/components/room/CreateRoomDialog.vue` | ActionFacade, LifecycleService |
| `src/components/room/JoinRoomDialog.vue` | ActionFacade |
| `src/components/room/RoomInviteActions.vue` | ActionFacade |
| `src/components/rightBox/chatBox/ChatHeader/ChatHeaderRoot.vue` | ActionFacade, MemberFacade |
| `src/components/workbench/WorkbenchQuickCreate.vue` | ActionFacade, LifecycleService |
| `src/hooks/useMessage.ts` | ActionFacade |
| `src/hooks/useChatMain.ts` | ActionFacade |
| `src/hooks/chatMain/useUserContextMenu.ts` | ActionFacade |
| `src/views/homeWindow/SpaceList.vue` | ActionFacade |
| `src/services/matrix/user/MatrixContactService.ts` | ActionFacade, QueryFacade, ReadFacade |

### Test files (10) - mock paths updated:

- `src/stores/domains/chat/__tests__/room.test.ts` - Split single mockRoomService into 4 sub-service mocks (ReadFacade, ActionFacade, CreationService, RealtimeService)
- `src/stores/domains/chat/chat/__tests__/message.test.ts` - Mock path changed
- `src/stores/domains/chat/chat/__tests__/messageActions.test.ts` - Mock path changed
- `src/components/room/__tests__/CreateRoomDialog.test.ts` - Split into ActionFacade + LifecycleService
- `src/components/room/__tests__/InviteDialog.test.ts` - Mock path changed
- `src/components/room/__tests__/JoinRoomDialog.test.ts` - Mock path changed
- `src/views/homeWindow/__tests__/SpaceList.test.ts` - Mock path changed
- `src/composables/room/__tests__/useRoomActions.test.ts` - Mock path changed
- `src/hooks/__tests__/useChatMain.test.ts` - Mock path changed
- `src/services/matrix/user/__tests__/MatrixContactService.test.ts` - Split into ActionFacade, QueryFacade, ReadFacade

### Barrel export files (2) - removed MatrixRoomService references:

- `src/services/matrix/room/index.ts`
- `src/services/matrix/index.ts`

### Other:

- `src/App.vue` - Lazy loader already pointed to ActionFacade (no change needed)

## Verification

- `vue-tsc --noEmit` passes clean
- All directly related tests pass (81 tests across 5 key test files)
- Full test suite: 354 test files pass, 32 pre-existing failures unrelated to this change
