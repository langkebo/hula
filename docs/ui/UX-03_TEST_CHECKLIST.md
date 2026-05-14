# UX-03 Real-device Test Checklist

## 1. Interaction & UI
- [ ] **RTL Layout**: Verify that the layout flips correctly when `dir="rtl"` is set (especially the avatar and presence badge positions).
- [ ] **Touch Targets**: Ensure buttons (message, remove, more) on `FriendListItem` are easy to tap on mobile.
- [ ] **Hover States**: Check that hover background color (#6366F1 10%) works on desktop and doesn't "stick" on touch devices.
- [ ] **Radius**: Confirm 12px border radius is consistent across all friend-related components.

## 2. Functional Verification
- [ ] **Search History**: Search for a friend, then verify the query appears in history chips.
- [ ] **Friend Requests**: Receive a request and verify the countdown timer updates (check after 1 hour if possible, or mock time).
- [ ] **Presence**: Open the app on two devices; change status on one and verify the online/offline indicator updates on the other in < 200ms.
- [ ] **Filtering**: Switch between "Favorite", "Blocked", and "Hidden" filters; verify counts in badges are accurate.

## 3. Performance
- [ ] **Scroll Smoothness**: Scroll through a list of 100+ friends; verify it maintains 60fps without stuttering.
- [ ] **Search Responsiveness**: Type quickly in the search bar; verify results update after the 240ms debounce without UI lag.
- [ ] **Diffing**: Add a friend via another client; verify the list updates incrementally without a full flash/reload.

## 4. Platform Specifics
- [ ] **Electron (Desktop)**: Verify context menu (right-click) appears at the correct mouse position.
- [ ] **Mobile Web**: Verify the layout fits within small viewports and doesn't horizontal scroll.
