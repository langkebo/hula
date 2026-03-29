# Changelog

## [3.0.9](https://gitee.com/llangkebo/hula/compare/v3.0.8...v3.0.9) (2026-01-19)

### ✨ Features | 新功能

* **chat:** :sparkles: support group member alias resolution when extracting [@mentions](https://github.com/mentions) ([86a7f3e](https://gitee.com/llangkebo/hula/commit/86a7f3e456b9cedc8a99f554557aa12cd0fb8e08))
* **i18n:** :sparkles: add loading states and system settings translations ([a08bb76](https://gitee.com/llangkebo/hula/commit/a08bb762ff66f353a2ff01f529d6b778f55d22cc))
* **i18n:** add i18n for community post ([7648f77](https://gitee.com/llangkebo/hula/commit/7648f777fd821ac7028b69423a3a3fa20caad046))
* **i18n:** enhance internationalization support by adding mobile titles and computed labels ([9c07f86](https://gitee.com/llangkebo/hula/commit/9c07f8695820227f29f1f5b3961096c9d9ec0ba5))
* **login:** :sparkles: add 3-second delay and cancel option for auto-login on desktop ([1f661ea](https://gitee.com/llangkebo/hula/commit/1f661eaaecf64c5e9ac411832b5a446c915be3e7))
* **login:** :sparkles: add message sync and error handling for OAuth login ([7d7f0c2](https://gitee.com/llangkebo/hula/commit/7d7f0c2d6bc438ba93546aeb756d63cf2388eee7))
* **login:** :sparkles: preload group member data and announcements during login ([2cc3eab](https://gitee.com/llangkebo/hula/commit/2cc3eab991a192cba654956fdc693ab2e75147ad))
* **monitor:** :sparkles: add development memory monitor component ([709bcc4](https://gitee.com/llangkebo/hula/commit/709bcc4514f0eab86e88e9e8e86247d51511764c))
* **notification:** :sparkles: add volume control for message alert sound ([d560912](https://gitee.com/llangkebo/hula/commit/d56091250799bcf35a751ff5764c197e1445c2e5))
* **skill:** :sparkles: add HuLa skill linking script and project context documentation ([0aaf60c](https://gitee.com/llangkebo/hula/commit/0aaf60c0d2e1b8484afe4b7b7ecb791b1ab66e53))
* **theme:** :sparkles: preserve user theme preference on app restart ([3d81c33](https://gitee.com/llangkebo/hula/commit/3d81c3338b8ef7d30a2ca883fbe16f035c9eb7f3))
* **view:** :sparkles: add gitecode login ([cf80f79](https://gitee.com/llangkebo/hula/commit/cf80f793334c8917a0b8c8ef7ea30c12aa3f31e6))

### 🐛 Bug Fixes | Bug 修复

* **chat:** :bug: validate emoji insertion range is within input box ([e027e32](https://gitee.com/llangkebo/hula/commit/e027e320aca2c12c2b0694d8c81d5fa76b0ecbb5))
* **ci:** :bug: fix draft release detection to avoid multiple release IDs for same tag ([342eae6](https://gitee.com/llangkebo/hula/commit/342eae600ca7394a4748ef04d1f589fd92ac6b8c))
* **common:** :bug: page the friends list ([cc14874](https://gitee.com/llangkebo/hula/commit/cc14874773b9eab5579d0a53e4a58193269651a5))
* **forget-password:** :bug: reset initial step to 1 from 3 ([cd42271](https://gitee.com/llangkebo/hula/commit/cd422712748e4659ad50e5c3893272ee11eac207))
* **group:** :bug: fix group member refresh problem in single chat ([4cd1c3c](https://gitee.com/llangkebo/hula/commit/4cd1c3cd66f605c58ad4115e023a39035ea4ed0e))
* **ios:** :bug: fix ios crash and auto login failure ([c860a14](https://gitee.com/llangkebo/hula/commit/c860a140e3b7a52ef1af7db5c553fa4c69b14ddc)), closes [#472](https://gitee.com/llangkebo/hula/issues/472)
* **ios:** :bug: fix ios real machine stuck on startup page due to useNetworkStatus() ([8c18806](https://gitee.com/llangkebo/hula/commit/8c18806a83cd83d0a435022a8dc15d74f4a81f9a))
* **ios:** :bug: fix ios simulator can't start ([cb2028a](https://gitee.com/llangkebo/hula/commit/cb2028a971acb2d6902a149885573d5e96557d3b))
* **ios:** :bug: fix packaging error due to ios permissions issue ([18fb1fd](https://gitee.com/llangkebo/hula/commit/18fb1fd14ea230782794d9ce6b11aeada29171c4))
* **logout:** :bug: skip token validation during logout to prevent error loops ([c65c740](https://gitee.com/llangkebo/hula/commit/c65c7407975bc959bebc01ca0f7ad7ff66486cc1))
* **plugin:** :bug: display of ai usage times ([ca10f5d](https://gitee.com/llangkebo/hula/commit/ca10f5ddce0fa51e390c00cbeac2c8e40b6c925a))
* **theme:** follow system to change theme ([7a7b5b2](https://gitee.com/llangkebo/hula/commit/7a7b5b24c133afb2dc9ca113a8c8020969a7af19))
* **view:** :bug: render gitcode icon ([0ba6187](https://gitee.com/llangkebo/hula/commit/0ba61876b34eb8f87a44d19f776c93a7a4f6e887))

## [3.0.8](https://gitee.com/llangkebo/hula/compare/v3.0.6...v3.0.8) (2025-12-31)

### ✨ Features | 新功能

* **AI rules:** :sparkles: add mainstream ai rules ([86c5d11](https://gitee.com/llangkebo/hula/commit/86c5d11ba81bafaf100f03dc48dd828b8b3515f4))
* **component:** :sparkles: add upgradelink ([15ca9a2](https://gitee.com/llangkebo/hula/commit/15ca9a2c7c76dbd0cc6edeab715a7a539b338741))
* **Drag Upload:** :sparkles: add drag file uploads ([70df9d5](https://gitee.com/llangkebo/hula/commit/70df9d5d24028e65f8d8864cb6d5bce3d7a3a7a3)), closes [#444](https://gitee.com/llangkebo/hula/issues/444)
* **group QR code:** :sparkles: add group QR code save and forward ([4ca6ccc](https://gitee.com/llangkebo/hula/commit/4ca6ccc3d5caa0e8dbd2da92756d82930b4ddf82))
* **ios:** :sparkles: add notification badges and improve iOS notification support ([c1b446b](https://gitee.com/llangkebo/hula/commit/c1b446b6a69b5563e56081ddc7aed98d3981b831))
* **layout:** :sparkles: add some page layouts to resize ([d069fe7](https://gitee.com/llangkebo/hula/commit/d069fe7f3bdf7df751ee93854ec75c3ac523d71e)), closes [#393](https://gitee.com/llangkebo/hula/issues/393)
* **macOS 26:** :sparkles: improved window traffic light button spacing processing logic ([2d0523c](https://gitee.com/llangkebo/hula/commit/2d0523c8a6760847853ab30407525e9f83487ca9))
* **macOS:** :sparkles: add traffic light button spacing and optimize iOS build support ([ad72331](https://gitee.com/llangkebo/hula/commit/ad72331c165c9dd0fc6b6be15761bbdaa1cda622))
* **mobile:** add mobile i18n support ([#449](https://gitee.com/llangkebo/hula/issues/449)) ([bdacf4e](https://gitee.com/llangkebo/hula/commit/bdacf4ed3f7af298d7ac0427f71f4140f2b9c2f7)), closes [#441](https://gitee.com/llangkebo/hula/issues/441) [#443](https://gitee.com/llangkebo/hula/issues/443) [#444](https://gitee.com/llangkebo/hula/issues/444)
* **plugin:** :sparkles: add ai stop reply ([61c6108](https://gitee.com/llangkebo/hula/commit/61c61083b98b7609f7a1a4c55c71497f3aadce41))
* **settings:** sync native theme ([#458](https://gitee.com/llangkebo/hula/issues/458)) ([c28ffaa](https://gitee.com/llangkebo/hula/commit/c28ffaa4518a0b1cbfd673219918e4124c493433))
* **sqlcipher:** :sparkles: add sqlcipher for sqlite encryption ([9aae783](https://gitee.com/llangkebo/hula/commit/9aae783f8cffe1da5d3bb49dbfa17910837e4d67)), closes [#438](https://gitee.com/llangkebo/hula/issues/438)
* **view:** :sparkles: add gitee and gitHub authorized login ([69c2e47](https://gitee.com/llangkebo/hula/commit/69c2e470c02be0b49a9c4533c76501ec3a5e6381))
* **vscode:** add i18n-ally configuration and update extensions ([5278ab4](https://gitee.com/llangkebo/hula/commit/5278ab435e36e0a3db15f9b9415191f69455b825))
* **window:** :sparkles: add windows, system theme follow and custom theme settings ([b20d674](https://gitee.com/llangkebo/hula/commit/b20d67436a5e3f941f7cebef24f94ed877bf7049))

### 🐛 Bug Fixes | Bug 修复

* **android:** :bug: add MODIFY_AUDIO_SETTINGS permission for audio control ([6b66141](https://gitee.com/llangkebo/hula/commit/6b661418e5df051c9bf846a1a4f3709993d1cf63)), closes [#IDGIXN](https://gitee.com/llangkebo/hula/issues/IDGIXN)
* **chat:** :bug: fix incorrect variable usage in currently selected room ([63748bd](https://gitee.com/llangkebo/hula/commit/63748bdad0643eaa11a0b31d4a8be1074dd28dfa))
* **common:** 🐛 simplify reconnection sync to avoid duplicate full syncs on first ([6057af2](https://gitee.com/llangkebo/hula/commit/6057af2ec72bb443ed7b894d849a8e62f5d164a4))
* **emoji:** :bug: fix a problem where emoticons were stuck when sent continuously ([38724e8](https://gitee.com/llangkebo/hula/commit/38724e8e10cabb6e1eee9cc0851ad3b11efa5dc7))
* **emoji:** :bug: fix emoji emoji list stuttering issue ([1c8ebfd](https://gitee.com/llangkebo/hula/commit/1c8ebfdf8a1cb172ee5941d487eeac48067f95a7))
* **favicon.ico:** :bug: fix error due to missing favicon.ico ([c08f89a](https://gitee.com/llangkebo/hula/commit/c08f89a57bb85dec3ac1e841630ea536e7965352))
* **group:** :bug: fix group member status sorting problem ([c90b871](https://gitee.com/llangkebo/hula/commit/c90b871cc9c727b817d2028aa1c6cefc8ef62668))
* **group:** :bug: fix group members online status and show unknown users ([3951265](https://gitee.com/llangkebo/hula/commit/395126591dcbb67bc93456546cffd0be027c2403))
* **ios:** :bug: improved iOS Simulator detection and build configuration ([8719def](https://gitee.com/llangkebo/hula/commit/8719def4b2a0298dfc06ca60e92f37c361b308f8))
* **nsis:** uninstall fails when manually close app on kill app dialog, per-machine installer not requesting elevation when run by non-admin users ([1bcc03e](https://gitee.com/llangkebo/hula/commit/1bcc03e963ec5d3f542e0a66b2cd6b0ce3cb057e))
* **perl:** :bug: handle 8.3 short filename format in Strawberry Perl prefix check ([34e9c4d](https://gitee.com/llangkebo/hula/commit/34e9c4dc2d3a2ed7e69246eed171500603bf1dbf))
* **proxy:** Fix the bug where the app does not load the user's previous configuration on launch ([be78edf](https://gitee.com/llangkebo/hula/commit/be78edf62f66821eaf40c1bf6d1d3016d5f3e714))
* **unread count:** :bug: fix inaccurate unread count on mac dock ([3f45dc7](https://gitee.com/llangkebo/hula/commit/3f45dc786242542cdbe3c3943fda81cf65ab36f3))
* **unread:** :bug: fix unread count not clearing when clicking session in full plmatfor view ([21fda09](https://gitee.com/llangkebo/hula/commit/21fda09cbc4b3913b6bcafcbc623a64688b1ac68))
* **UnreadCount:** :bug: continue to repair session check unread count unerased ([433cad4](https://gitee.com/llangkebo/hula/commit/433cad4f9f3d849e580a908c9e876edcff497511))
* **unreadCount:** :bug: fix dock icon unread count not displayed on mac ([960978c](https://gitee.com/llangkebo/hula/commit/960978c465fb2889e95a4d7c63548fb429ff96a3))
* **win:** :bug: add and install Perl script to fix win startup problems ([0a658a7](https://gitee.com/llangkebo/hula/commit/0a658a77e0c246703111d1fbb86e86ffca0bc1ac))
* **win:** :bug: fix win10 multi-screen high resolution layout confusion due to useFixedScale ([0f2854a](https://gitee.com/llangkebo/hula/commit/0f2854aa8db56a17a3995cfa48b137fa229b1f7f)), closes [#389](https://gitee.com/llangkebo/hula/issues/389)

### ⚡️ Performance Improvements | 性能优化

* **chat:** :zap: increase message list size limit and memory footprint ([9638de0](https://gitee.com/llangkebo/hula/commit/9638de05b639b0c92de79ef23fdfad50690f605e))
* **common:** :zap: optimize message storage and timer for some uncleaned footprint ([e0e7a9b](https://gitee.com/llangkebo/hula/commit/e0e7a9bf4b84d259e2c98e47f5fefec45b6b77ad))
* **DPI:** :zap: add monitor-aware window size clamping to prevent oversized windows ([97074ac](https://gitee.com/llangkebo/hula/commit/97074ac9f4bee44361e6a64b1bb68d6e6c675f1d))
* **Keychain:** :zap: mac does not use Keychain to save keys by default ([4483307](https://gitee.com/llangkebo/hula/commit/44833079f86a63ff24e394d83dc8b080af3f4543))
* **layout:** :zap: optimize group member loading ([76ab5f5](https://gitee.com/llangkebo/hula/commit/76ab5f5ae1cb459d5252ef2265787267af96de4f))
* **media:** :zap: optimize multimedia presentation on PC and mobile ([54902c9](https://gitee.com/llangkebo/hula/commit/54902c9649cebcf4cdc70b45ff82e0d44aff691a))
* **moblie:** :zap: optimize mobile text bubble display ([2cab73a](https://gitee.com/llangkebo/hula/commit/2cab73afd872cfd156a49c0611743ca550d79e68))
* **pc circle of friends:** :zap: optimize page layout and style of PC circle of friends ([25bf49d](https://gitee.com/llangkebo/hula/commit/25bf49d8e3e0eaefa5cd7d832d67bd8706db4348))
* **PC circle of friends:** :zap: optimize the scroll bar layout of the PC friend circle ([11dff28](https://gitee.com/llangkebo/hula/commit/11dff28bbdc3c05d168a41bbc91b771182f10c30))
* **pc list scroll:** :zap: optimize message list scrolling sometimes without bottoming ([3488b3a](https://gitee.com/llangkebo/hula/commit/3488b3adf51abb656c46ac743eadd6393e4b061c))

## [3.0.7](https://gitee.com/llangkebo/hula/compare/v3.0.6...v3.0.7) (2025-12-19)

### ✨ Features | 新功能

* **component:** :sparkles: add upgradelink ([15ca9a2](https://gitee.com/llangkebo/hula/commit/15ca9a2c7c76dbd0cc6edeab715a7a539b338741))
* **layout:** :sparkles: add some page layouts to resize ([d069fe7](https://gitee.com/llangkebo/hula/commit/d069fe7f3bdf7df751ee93854ec75c3ac523d71e)), closes [#393](https://gitee.com/llangkebo/hula/issues/393)
* **plugin:** :sparkles: add ai stop reply ([61c6108](https://gitee.com/llangkebo/hula/commit/61c61083b98b7609f7a1a4c55c71497f3aadce41))
* **sqlcipher:** :sparkles: add sqlcipher for sqlite encryption ([9aae783](https://gitee.com/llangkebo/hula/commit/9aae783f8cffe1da5d3bb49dbfa17910837e4d67)), closes [#438](https://gitee.com/llangkebo/hula/issues/438)
* **vscode:** add i18n-ally configuration and update extensions ([5278ab4](https://gitee.com/llangkebo/hula/commit/5278ab435e36e0a3db15f9b9415191f69455b825))

### 🐛 Bug Fixes | Bug 修复

* **chat:** :bug: fix incorrect variable usage in currently selected room ([63748bd](https://gitee.com/llangkebo/hula/commit/63748bdad0643eaa11a0b31d4a8be1074dd28dfa))
* **emoji:** :bug: fix a problem where emoticons were stuck when sent continuously ([38724e8](https://gitee.com/llangkebo/hula/commit/38724e8e10cabb6e1eee9cc0851ad3b11efa5dc7))
* **emoji:** :bug: fix emoji emoji list stuttering issue ([1c8ebfd](https://gitee.com/llangkebo/hula/commit/1c8ebfdf8a1cb172ee5941d487eeac48067f95a7))
* **favicon.ico:** :bug: fix error due to missing favicon.ico ([c08f89a](https://gitee.com/llangkebo/hula/commit/c08f89a57bb85dec3ac1e841630ea536e7965352))
* **group:** :bug: fix group member status sorting problem ([c90b871](https://gitee.com/llangkebo/hula/commit/c90b871cc9c727b817d2028aa1c6cefc8ef62668))
* **group:** :bug: fix group members online status and show unknown users ([3951265](https://gitee.com/llangkebo/hula/commit/395126591dcbb67bc93456546cffd0be027c2403))
* **perl:** :bug: handle 8.3 short filename format in Strawberry Perl prefix check ([34e9c4d](https://gitee.com/llangkebo/hula/commit/34e9c4dc2d3a2ed7e69246eed171500603bf1dbf))
* **unread count:** :bug: fix inaccurate unread count on mac dock ([3f45dc7](https://gitee.com/llangkebo/hula/commit/3f45dc786242542cdbe3c3943fda81cf65ab36f3))
* **unread:** :bug: fix unread count not clearing when clicking session in full plmatfor view ([21fda09](https://gitee.com/llangkebo/hula/commit/21fda09cbc4b3913b6bcafcbc623a64688b1ac68))
* **UnreadCount:** :bug: continue to repair session check unread count unerased ([433cad4](https://gitee.com/llangkebo/hula/commit/433cad4f9f3d849e580a908c9e876edcff497511))
* **unreadCount:** :bug: fix dock icon unread count not displayed on mac ([960978c](https://gitee.com/llangkebo/hula/commit/960978c465fb2889e95a4d7c63548fb429ff96a3))
* **win:** :bug: add and install Perl script to fix win startup problems ([0a658a7](https://gitee.com/llangkebo/hula/commit/0a658a77e0c246703111d1fbb86e86ffca0bc1ac))
* **win:** :bug: fix win10 multi-screen high resolution layout confusion due to useFixedScale ([0f2854a](https://gitee.com/llangkebo/hula/commit/0f2854aa8db56a17a3995cfa48b137fa229b1f7f)), closes [#389](https://gitee.com/llangkebo/hula/issues/389)

### ⚡️ Performance Improvements | 性能优化

* **chat:** :zap: increase message list size limit and memory footprint ([9638de0](https://gitee.com/llangkebo/hula/commit/9638de05b639b0c92de79ef23fdfad50690f605e))
* **common:** :zap: optimize message storage and timer for some uncleaned footprint ([e0e7a9b](https://gitee.com/llangkebo/hula/commit/e0e7a9bf4b84d259e2c98e47f5fefec45b6b77ad))
* **DPI:** :zap: add monitor-aware window size clamping to prevent oversized windows ([97074ac](https://gitee.com/llangkebo/hula/commit/97074ac9f4bee44361e6a64b1bb68d6e6c675f1d))
* **Keychain:** :zap: mac does not use Keychain to save keys by default ([4483307](https://gitee.com/llangkebo/hula/commit/44833079f86a63ff24e394d83dc8b080af3f4543))
* **layout:** :zap: optimize group member loading ([76ab5f5](https://gitee.com/llangkebo/hula/commit/76ab5f5ae1cb459d5252ef2265787267af96de4f))
* **media:** :zap: optimize multimedia presentation on PC and mobile ([54902c9](https://gitee.com/llangkebo/hula/commit/54902c9649cebcf4cdc70b45ff82e0d44aff691a))
* **moblie:** :zap: optimize mobile text bubble display ([2cab73a](https://gitee.com/llangkebo/hula/commit/2cab73afd872cfd156a49c0611743ca550d79e68))
* **pc circle of friends:** :zap: optimize page layout and style of PC circle of friends ([25bf49d](https://gitee.com/llangkebo/hula/commit/25bf49d8e3e0eaefa5cd7d832d67bd8706db4348))
* **PC circle of friends:** :zap: optimize the scroll bar layout of the PC friend circle ([11dff28](https://gitee.com/llangkebo/hula/commit/11dff28bbdc3c05d168a41bbc91b771182f10c30))
* **pc list scroll:** :zap: optimize message list scrolling sometimes without bottoming ([3488b3a](https://gitee.com/llangkebo/hula/commit/3488b3adf51abb656c46ac743eadd6393e4b061c))

## [3.0.6](https://gitee.com/llangkebo/hula/compare/v3.0.5...v3.0.6) (2025-12-07)

### ✨ Features | 新功能

* **common:** :sparkles: add to minio storage ([9d68254](https://gitee.com/llangkebo/hula/commit/9d682545f72c5253e57c6b749d19c37f3e1e10ee))
* **mac、linux:** :sparkles: add webview intrusion protection for mac and linux platforms ([7001ed0](https://gitee.com/llangkebo/hula/commit/7001ed0fcd517766e3e09eeb5f063460980a77ad))
* **plugin:** :sparkles: deep Thinking Model for AI Interface ([527045a](https://gitee.com/llangkebo/hula/commit/527045a2c9280625c0af8292aa85ae794ce7dd3d))
* **security:** :sparkles: add Windows runtime security guards ([e66738c](https://gitee.com/llangkebo/hula/commit/e66738c18509292e22e9683796544c98601ac023))

### 🐛 Bug Fixes | Bug 修复

* **common:** :bug: fix cursor out of focus and read report race issues ([c581c76](https://gitee.com/llangkebo/hula/commit/c581c76bd94d7721615a1a4238ceed94b816dc3b))
* **emoji:** :bug: fix ix my emoji download logic ([17b2126](https://gitee.com/llangkebo/hula/commit/17b21269a973abc88ec41e6818ef3f64bc92bf10)), closes [#390](https://gitee.com/llangkebo/hula/issues/390)
* **i18n:** :bug: fix some content without i18n support ([5bc55dd](https://gitee.com/llangkebo/hula/commit/5bc55ddf151734589abe834ea53b3bf02d5faa1d))
* **README:** :bug: fix README layout issues and show withdrawn message lists ([d631f9b](https://gitee.com/llangkebo/hula/commit/d631f9b27107e6de5a1fc60b6ee66092c4ddeb2d))
* **recall:** :bug: fix Reedit after Withdrawal does not disappear ([5562e54](https://gitee.com/llangkebo/hula/commit/5562e5479f47b62a0d9b42c5e79d72abcc4d3b93))
* **session:** :bug: fix selected session unable to read unread count ([3582920](https://gitee.com/llangkebo/hula/commit/35829206ad39076728ff558371424ee1c1291342))
* **session:** :bug: fix session unread count not resetting issue ([fb2a076](https://gitee.com/llangkebo/hula/commit/fb2a0767edab1f0430670b6def14213068526651))
* **session:** :bug: fix unread tag cannot be removed issue ([3f3332b](https://gitee.com/llangkebo/hula/commit/3f3332ba676f026836d122a5639020040ed84d35))
* **view:** :bug: connect to Tencent Address ResolutionConnect to Tencent Address Resolution ([2138613](https://gitee.com/llangkebo/hula/commit/2138613576705ab1683de998114d2fadda20b3d4))
* **view:** :bug: switch to backend translationSwitch to backend translation ([0397989](https://gitee.com/llangkebo/hula/commit/0397989c7fde86cf8146cb256a730f2c4c20a741))
* **windows:** :bug: fix code bug with win_runtime_guard ([c4f73d0](https://gitee.com/llangkebo/hula/commit/c4f73d04ff95c7ee89efe29d4142d3413ee00014))

### ⚡️ Performance Improvements | 性能优化

* **sync:** :zap: do not reset selected sessions when synchronizing messages ([b583031](https://gitee.com/llangkebo/hula/commit/b583031367082ec5cb6d1b7ff5496f72bd0de57b))

## [3.0.5](https://gitee.com/llangkebo/hula/compare/v3.0.4...v3.0.5) (2025-11-28)


### ✨ Features | 新功能

* **del msg:** :sparkles: add delete chat log function ([0698866](https://gitee.com/llangkebo/hula/commit/0698866226589b429594941e7e385e35bea4378b)), closes [#386](https://gitee.com/llangkebo/hula/issues/386)
* **i18n:** :sparkles: add English translations for agreement, auth, dynamic, and settings modules ([f9e6693](https://gitee.com/llangkebo/hula/commit/f9e6693163382956596380c824e185973980a29f))
* **i18n:** :sparkles: add i18n for remaining pages and fix content disorder ([b7ec9b2](https://gitee.com/llangkebo/hula/commit/b7ec9b21d47be15b46ed1512418cdfb603318ba4))
* **i18n:** :sparkles: add recognition of language auto ([8aee1f0](https://gitee.com/llangkebo/hula/commit/8aee1f0ef894962751c44f669ced410e978fb832))
* **i18n:** :sparkles: bring i18 n-compatible pages to 98%（exc mobile） ([d582052](https://gitee.com/llangkebo/hula/commit/d582052da4733262aa1be8395dbf36b22b88958e))
* **i18n:** :sparkles: i18n to add content for other pages and windows ([715d629](https://gitee.com/llangkebo/hula/commit/715d6298791aa4bf23de367ba615f4c5b62aef15))
* **i18n:** add internationalization support ([#405](https://gitee.com/llangkebo/hula/issues/405)) ([799dce1](https://gitee.com/llangkebo/hula/commit/799dce10e11e4b6286c086af103ad3d52624cfa9))
* **i18n:** add new translation entries ([#409](https://gitee.com/llangkebo/hula/issues/409)) ([fe3085b](https://gitee.com/llangkebo/hula/commit/fe3085b4fde3c059c00a2d9c4c6f64a58cb89176))
* **log:** :sparkles: add versioning details for console output ([c0d3fc9](https://gitee.com/llangkebo/hula/commit/c0d3fc9a97d38a51d78512cdaaec197801be1997))
* **message:** :sparkles: add click user name auto @ ([5ca19e2](https://gitee.com/llangkebo/hula/commit/5ca19e2f37948398f8ccef72b1ec6e17081f1023)), closes [#385](https://gitee.com/llangkebo/hula/issues/385)
* **session:** :sparkles: add persistent unread count cache for sessions ([a00ea17](https://gitee.com/llangkebo/hula/commit/a00ea17755547a7b0f67a0e86c6b666062d264ed))
* **sync:** :sparkles: add message sync throttling and optimize login flow ([d3690b1](https://gitee.com/llangkebo/hula/commit/d3690b1ab6a4b2f4408ac44085bb6b2c8baa2446))
* **theme:** :sparkles: add login window and other windows compatible with dark mode ([581daac](https://gitee.com/llangkebo/hula/commit/581daac28dd6b73a421bda65f8b69098d30d724f))
* **webSocket:** :sparkles: add automatic message sync after reconnection ([5411cc4](https://gitee.com/llangkebo/hula/commit/5411cc4e1f89a7bfbc6dd7fcde47d9f7417920c6))


### 🐛 Bug Fixes | Bug 修复

* commits list not collapsible ([f938c49](https://gitee.com/llangkebo/hula/commit/f938c497c47f6b4ab36fe75106301c44848846a7))
* **common:** :bug: add loading indicator for message synchronization during reconnection and login ([36444f6](https://gitee.com/llangkebo/hula/commit/36444f62025788e9b03756943cfeef058f8b1643))
* **common:** :bug: fix friend request message maximum width issue ([0715860](https://gitee.com/llangkebo/hula/commit/07158608d45a59bde82ec1037ce8b8af49632087))
* **common:** :bug: fix model avatar modificationFix model avatar modification ([8c15424](https://gitee.com/llangkebo/hula/commit/8c15424116f97b48b5cc0e93d96f6d881cdf9b21))
* **common:** :bug: fix recall message conversation list not updated ([e072c27](https://gitee.com/llangkebo/hula/commit/e072c27ec7050998a43b87384fc15106bc19461c))
* **common:** :bug: optimize QR code login ([ae69f57](https://gitee.com/llangkebo/hula/commit/ae69f579300714d2fb04081a7bc45e5e08c5ea54))
* **common:** :bug: wS reconnection request message ([daefd83](https://gitee.com/llangkebo/hula/commit/daefd839a981bfa9de7b426d13a3843a14aafc0d))
* **i18n:** :bug: migrate to Composition API mode and add reactive locale support ([73b71d4](https://gitee.com/llangkebo/hula/commit/73b71d46c938fda8e94928caddacd91a842a565f))
* **mac:** :bug: disable mac right-click selected text features ([fb95df5](https://gitee.com/llangkebo/hula/commit/fb95df576e20ac805fd3af6cafacbd26b80a8a59))
* **mobile:** :bug: fix the QR code scanning failure issue ([58812f9](https://gitee.com/llangkebo/hula/commit/58812f90ce30937fce88eddaa60e4752478091fe))
* **notification:** :bug: fix batch modification group notifications not taking effect ([3a8dd7c](https://gitee.com/llangkebo/hula/commit/3a8dd7c0090c07c838370d772d82e04b83e77250))
* **plugin:** :bug: adapt to deep thinking ([f419cd2](https://gitee.com/llangkebo/hula/commit/f419cd241e3a75438e6cbef18009e52eb460c89a))
* **plugin:** :bug: add AI balance inquiry ([e3db8ce](https://gitee.com/llangkebo/hula/commit/e3db8ce0318882d75041fbe9ad08174ec4689929))
* **session:** :bug: add null safety checks for currentSession across components ([993648d](https://gitee.com/llangkebo/hula/commit/993648d13504703e655f8591a6e41a71ba4d9790))
* **types:** narrow LoadLocale return type to Record<string, string> ([#407](https://gitee.com/llangkebo/hula/issues/407)) ([ff5e94f](https://gitee.com/llangkebo/hula/commit/ff5e94ffd235c4ec532287c7bbbaa33056da7f4c))
* **update:** prevent program from exiting when only update window is open ([5b53fa5](https://gitee.com/llangkebo/hula/commit/5b53fa53dc32a2d8b8959d96fa9ec831de190a45))
* upgrade @tauri-apps/plugin-barcode-scanner from 2.4.0 to 2.4.2 ([caf0bb2](https://gitee.com/llangkebo/hula/commit/caf0bb22bf32083114bcb7d6b5fb08e6336b6acd))
* upgrade dayjs from 1.11.18 to 1.11.19 ([4c6fff7](https://gitee.com/llangkebo/hula/commit/4c6fff7d4337bc7e79b2a10d23c798f13bf00f3f))
* upgrade hula-emojis from 1.2.30 to 1.2.31 ([15a69c3](https://gitee.com/llangkebo/hula/commit/15a69c3e72ada32a2f5b233baffcaffa4a7bec85))
* upgrade pinia from 3.0.3 to 3.0.4 ([70aa7c3](https://gitee.com/llangkebo/hula/commit/70aa7c34d90c7d923a2086426a17335cfd3305f8))
* **window:** handle tray window on Windows; prevent exit blocking when update window closes ([907d5e6](https://gitee.com/llangkebo/hula/commit/907d5e62d4ab1646ef06d41bb73e4459ea6c85f3))


### ⚡️ Performance Improvements | 性能优化

* **common:** :zap: optimize my emoji page caching logic ([2999564](https://gitee.com/llangkebo/hula/commit/29995649ee4a33dab5cf7fd90cb393c6a1b1c0d2))
* **i18n:** :zap: add i18n support for dayjs ([7dba84b](https://gitee.com/llangkebo/hula/commit/7dba84b56631c83ea6aba166305d13badb7c5d2f))
* **i18n:** :zap: add some pages to support i18n ([e6240d0](https://gitee.com/llangkebo/hula/commit/e6240d0395dad281eea014aa56314abd9a61aa75))

## [3.0.4](https://gitee.com/llangkebo/hula/compare/v3.0.3...v3.0.4) (2025-11-14)


### ✨ Features | 新功能

* **common:** :sparkles: generate images sounds videos text ([c46cd1a](https://gitee.com/llangkebo/hula/commit/c46cd1a85cfe3ea0f3464dfb4311927020b50caa))


### 🐛 Bug Fixes | Bug 修复

* **android:** :bug: fix android does not start due to version dependency ([0ff3ecc](https://gitee.com/llangkebo/hula/commit/0ff3ecc75f042cc2d7276b4f144c447fdf938e94))
* **android:** :bug: fix android packaging issues ([1e2b748](https://gitee.com/llangkebo/hula/commit/1e2b748494e9addae780588e72cc907abd5a5a47))
* **ci:** :bug: fix release.yml issues ([b59d517](https://gitee.com/llangkebo/hula/commit/b59d51771712a99839d7884a594291ca3d391592))
* **common:** :bug: develop Gitee AI ([9b76348](https://gitee.com/llangkebo/hula/commit/9b76348cd23472b5d99f608b496381ed5ec1bd8f))
* **common:** :bug: development ai platform ([4b5b8d1](https://gitee.com/llangkebo/hula/commit/4b5b8d1d4460f80aedb040db82e76e520e91b43c))
* **common:** :bug: fix message loss when resetting message after bottoming ([a0e2178](https://gitee.com/llangkebo/hula/commit/a0e2178177f2cd95c854a3e204aa1c63dff478d1))
* **hooks:** :bug: fix restart application is not ready to call tauri command ([23ca225](https://gitee.com/llangkebo/hula/commit/23ca2252696e563b2ba00ff4177cdd98fed0b5fe))
* **release:** :bug: fix ci issue in release version ([f0c4cd1](https://gitee.com/llangkebo/hula/commit/f0c4cd18dfdc866a4449c83215b63e9528578c15))


### ⚡️ Performance Improvements | 性能优化

* **cache:** :zap: optimize thumbnail download and rendering ([a1a80fd](https://gitee.com/llangkebo/hula/commit/a1a80fd291ac45364ac9596b5702bf7f9c21fc63))
* **common:** :zap: optimize pop-up logic for child windows and restrictions on mac ([6fe865c](https://gitee.com/llangkebo/hula/commit/6fe865c03b265aba801a962a2b8cc1d0593564d6))
* **common:** :zap: responsive expressions for optimizing lists ([f372241](https://gitee.com/llangkebo/hula/commit/f372241390e90db96e2a7fed85eba84fba30cd10))

## [3.0.3](https://gitee.com/llangkebo/hula/compare/v3.0.2...v3.0.3) (2025-11-06)


### ✨ Features | 新功能

* **common:** :sparkles: comments and likes in the WeChat Moments ([0d84851](https://gitee.com/llangkebo/hula/commit/0d84851414e7341dcdcd0fefd6887964909e1918))
* **mobile:** :sparkles: added "Dynamic List" feature for mobile ([5a7068a](https://gitee.com/llangkebo/hula/commit/5a7068a3a557c101457c7bb0a638d13bc5270e02))
* **mobile:** :sparkles: added "Post Dynamic" feature for desktop ([083d81d](https://gitee.com/llangkebo/hula/commit/083d81d0e43b12373318fa348356b7b0fce4ac48))
* **mobile:** :sparkles: added "Post Dynamic" feature for mobile ([a588729](https://gitee.com/llangkebo/hula/commit/a5887299b2d0980ad45ca8d8955affa1e3fb954d))
* **mobile:** :sparkles: added batch member removal, disabled for official groups ([f13c70b](https://gitee.com/llangkebo/hula/commit/f13c70b924e759842af5add7712d6280822e440d))
* **mobile:** :sparkles: added forced re-login on token expiration ([ac0e55b](https://gitee.com/llangkebo/hula/commit/ac0e55bee95d17b9b5b62a87f06c93576e50bc44))
* **mobile:** :sparkles: added photo album feature on mobile; added blank AI assistant page ([38eb9e5](https://gitee.com/llangkebo/hula/commit/38eb9e5d23d1cf9e45d7c8d872861ef07258fb86))
* **mobile:** :sparkles: added the feature to invite friends to join the group ([e3df3e2](https://gitee.com/llangkebo/hula/commit/e3df3e2f302cbd0daad8e99f7ef9304c1010850c))
* **mobile:** :sparkles: added the group member management page ([236c085](https://gitee.com/llangkebo/hula/commit/236c08599061548136d3a10ebf9b5f95b9740a48))
* **mobile:** :sparkles: new "Add Announcement" feature added to the mobile app ([c7cce79](https://gitee.com/llangkebo/hula/commit/c7cce79d6b2044b46d4beb6ea3217af91f8fed99))
* **mobile:** :sparkles: optimize dynamic page display performance on PC ([15defcb](https://gitee.com/llangkebo/hula/commit/15defcb5a5643ad4559956380d99f6e95f4d2b30))
* **mobile:** :sparkles: optimize the layout and functionality of dynamic pages ([7a18971](https://gitee.com/llangkebo/hula/commit/7a18971c48bc744be90d1a4ee78c31c9ee8536d9))
* **view:** :sparkles: abutment ai apiKey、model、role ([392c159](https://gitee.com/llangkebo/hula/commit/392c15900c5763ea069138e6585442e1df75929b))
* **view:** :sparkles: add a new dynamic detail page ([32c5186](https://gitee.com/llangkebo/hula/commit/32c5186bc10dd68e57aac7f43719d184a0953632))
* **view:** :sparkles: added AI message reply feature, integrated with server-side SSE ([03329fe](https://gitee.com/llangkebo/hula/commit/03329febe240001217e51a727c309a6f617b281f))


### 🐛 Bug Fixes | Bug 修复

* **android:** :bug: fix error caused by Chromium 91 version not importing 4k wasm in Android ([6d0d95e](https://gitee.com/llangkebo/hula/commit/6d0d95e0b149ce206855396fdf8672bc60265412))
* **announcement:** :bug: fix bulletin does not display issue ([6c52904](https://gitee.com/llangkebo/hula/commit/6c529047f217364cfd6bcae42f1abe42ca16ffab))
* **badge:** :bug: fix issues caused by missing badge fields ([9deb0fc](https://gitee.com/llangkebo/hula/commit/9deb0fc4f96caa9aa900e3aaf5badda58a56b310))
* **build:** :bug: fix packaging error due to parameter problem ([dbf504b](https://gitee.com/llangkebo/hula/commit/dbf504b591abb1fe9f7234fc23e9360ffdcd2890))
* **chat:** :bug: fix unread count not initialized ([c7d73bf](https://gitee.com/llangkebo/hula/commit/c7d73bf1f4eb0d2fa956fd67dc4427f085c1485e))
* **chatBot:** :bug: fix package startup error due to md stream rendering component ([712c1df](https://gitee.com/llangkebo/hula/commit/712c1df912f9288594b1949353dc6d81a352da4e))
* **chatBot:** :bug: fix some model synchronization issues with chatBot ([8b664b1](https://gitee.com/llangkebo/hula/commit/8b664b16263fb74a28454ce9f231e4f14337e1d7))
* **common:** :bug: add AI interface ([c65c3e7](https://gitee.com/llangkebo/hula/commit/c65c3e7840f3b979ad71b5360f14590049729f5f))
* **common:** :bug: add group info method ([f763517](https://gitee.com/llangkebo/hula/commit/f7635175a3c203da18de57a1fb4d0a27aa8a4f5a))
* **common:** :bug: adjust login parameters ([fd85394](https://gitee.com/llangkebo/hula/commit/fd85394e43ec0a56fe645fb2e3437ad1a5f725fa))
* **common:** :bug: allow modification of public roles and models ([ec6a28e](https://gitee.com/llangkebo/hula/commit/ec6a28edc1c6499b7c17915117020712d81f91b8))
* **common:** :bug: default values for homeWindowState ([d838709](https://gitee.com/llangkebo/hula/commit/d838709b9f9f80143439635bbbcbafcda92b6723))
* **common:** :bug: fix group chats invitation approval ([687a907](https://gitee.com/llangkebo/hula/commit/687a907f933d097b4e1358f08bdf907f0adb5ee5))
* **common:** :bug: fix some issues with tray reminders ([24ba1e6](https://gitee.com/llangkebo/hula/commit/24ba1e6618c05de3456bb64714c1fd97c7d0f2e3))
* **common:** :bug: modify the location of the remote login window ([c01304f](https://gitee.com/llangkebo/hula/commit/c01304fb356bc67d1081a8c4663efe7d3473feb7))
* **common:** :bug: optimize apikeyapikey ([5de0982](https://gitee.com/llangkebo/hula/commit/5de0982357e892dc3ae1bd38fa45d3caf6f76029))
* **common:** :bug: optimize comment rendering in MomentsOptimize comment rendering in Moments ([c04adb1](https://gitee.com/llangkebo/hula/commit/c04adb1bae4fc7baae207ad3d20368a18a9a0504))
* **currentSession:** :bug: modify the way roomId gets and administrator settings issues ([91436c6](https://gitee.com/llangkebo/hula/commit/91436c690f9e2360009ae74b13de1bcfcbe995f8))
* **invite:** :bug: fix failure to invite people into groups ([3e64d8a](https://gitee.com/llangkebo/hula/commit/3e64d8ad7531ff5f1149d857f7d686bd63ad17b6))
* **mobile:** :bug: distinguish between friends and groups when refreshing notifications ([5c9f230](https://gitee.com/llangkebo/hula/commit/5c9f230a4d57cdd794d13de42067814f7ccd40f5))
* **mobile:** :bug: fix issues with the emoji sticker panel and click interactions ([e7db486](https://gitee.com/llangkebo/hula/commit/e7db486b3a6b92719329b43de85c28be6ec6a0a1))
* **mobile:** :bug: fix mobile frontend login issue ([d8ebde5](https://gitee.com/llangkebo/hula/commit/d8ebde5b8c7a3b6db936e29a19adfb5bc04612ad))
* **mobile:** :bug: fix mobile tab bar safe area bug during navigation ([de35722](https://gitee.com/llangkebo/hula/commit/de35722f18e3cccfb45c9a4330534ac2332163dd))
* **mobile:** :bug: fix the issue where automatic login fails on mobile devices ([faa8a09](https://gitee.com/llangkebo/hula/commit/faa8a09b866fe604511b231263f38b553c653204))
* **mobile:** :bug: reposted in Moments, unread notification in Moments ([08a3abc](https://gitee.com/llangkebo/hula/commit/08a3abc6cc8591bf7b55e5c0dca797fe221b0ba3))
* **mobile:** :bug: reuse the "Group Chat Member Management" page ([f8c22e6](https://gitee.com/llangkebo/hula/commit/f8c22e6648f9e140cfcc292ac972c4d0e7d921b5))
* **renderMessage:** :bug: fix problems with clicking @ in history window causing jump ([79016f6](https://gitee.com/llangkebo/hula/commit/79016f65e95d3688b021e5027d280ad3b65d72f8))
* **session:** :bug: fix duplicate session creation issue ([2ed17d5](https://gitee.com/llangkebo/hula/commit/2ed17d5d72de0a0b5d3e2ce5a66546ca5950386a))
* **view:** :bug: 修复注册窗口打开的情况下登录后注册窗口不会被自动关闭 ([eaea8f8](https://gitee.com/llangkebo/hula/commit/eaea8f87456fc5189a9b858e9d12ebf38dea9ef0))
* **view:** :bug: aI interface for CRUD operations ([68826f5](https://gitee.com/llangkebo/hula/commit/68826f5ade35ce11cbcc865d02623f2845b8c5d8))
* **view:** :bug: aI Module ([80466f9](https://gitee.com/llangkebo/hula/commit/80466f995e764a2bc6b625a4bdf04dfa8468e8a6))
* **view:** :bug: reuse the IM client to handle AI data streams ([bb244fd](https://gitee.com/llangkebo/hula/commit/bb244fd1e97b4bebc55fa580e7555972f8a9f28e))
* **view:** :bug: type cannot be selected when repairing AI-generated characters ([04030fc](https://gitee.com/llangkebo/hula/commit/04030fc4aee382695c2930f88bec1b70f1463f0d))


### ⚡️ Performance Improvements | 性能优化

* **chatBot:** :zap: optimize chatBot rendering code block issues ([7e21a12](https://gitee.com/llangkebo/hula/commit/7e21a123b4a77ccb772364a0d3cec2b5f4d9b1ee))
* **common:** :zap: add performance monitoring to optimize some performance issues ([0c6c438](https://gitee.com/llangkebo/hula/commit/0c6c438f44d06ae6fdce8b936609feb515ac4df0))
* **common:** :zap: optimize session handover stagnation ([6607283](https://gitee.com/llangkebo/hula/commit/660728333c98da9f79dfec43397222c9846bf093))
* **common:** :zap: optimize session lists and chat stores ([1fb6c77](https://gitee.com/llangkebo/hula/commit/1fb6c77f34a091dc57b9934537bda72e23ba73b5))
* **common:** :zap: optimize session presentation ([67e9f1d](https://gitee.com/llangkebo/hula/commit/67e9f1d8a106f1be768f4969f6a860a5cefe97e6))
* **common:** :zap: optimizing Channel Switching Session Stagnation ([966abeb](https://gitee.com/llangkebo/hula/commit/966abeb2bfdd645a6587e4e9471570ba96305613))
* **common:** :zap: replace lodash-es with es-toolkit ([6ed3052](https://gitee.com/llangkebo/hula/commit/6ed3052a378aa9dc651fb6c48f6c53dfc5aa62ba))
* **notifications:** :zap: optimize unread counts for friend and group chat notifications ([c96f13e](https://gitee.com/llangkebo/hula/commit/c96f13e1490473672758c27f3e15d35a932172d4))
* **style:** :zap: optimize the format display of ai output ([e449118](https://gitee.com/llangkebo/hula/commit/e449118268027a8244e1c4ba16e4469f5b6239df))

## [3.0.2](https://gitee.com/llangkebo/hula/compare/v3.0.1...v3.0.2) (2025-10-24)


### ✨ Features | 新功能

* **mobile:** :sparkles: add First-Time Login Confirmation Page ([135bd26](https://gitee.com/llangkebo/hula/commit/135bd26ef258d430282cba357cf49f8c6dc637f6))
* **mobile:** :sparkles: improve the announcement editing function ([846a5c5](https://gitee.com/llangkebo/hula/commit/846a5c5791fa923cdd533189d88a1d7410c372eb))


### 🐛 Bug Fixes | Bug 修复

* **common:** :bug: modify logic of registration pop-up captcha ([7ba133d](https://gitee.com/llangkebo/hula/commit/7ba133da6218b42ff9789f836d4e7df5e8405677))
* **hook:** :bug: click the message to resend the audio and video message ([839bea9](https://gitee.com/llangkebo/hula/commit/839bea95b5c4183eb3e19b4bc7b5d02f5fd09709))
* **ios:** :bug: fix ios keyboard pop-up problem ([ab933e3](https://gitee.com/llangkebo/hula/commit/ab933e37ffbb10e879cd35ce8da12cd58751c17a))
* **location:** :bug: fix location cannot send issue ([78cdf84](https://gitee.com/llangkebo/hula/commit/78cdf846d125c182c43bf9319f133d849a511d54))
* **mobile:** :bug: "Fixed style issues; excluded Hula Assistant when adding group chats ([d865a1f](https://gitee.com/llangkebo/hula/commit/d865a1f9035a1a9f1c4c8dd6ad7a865e27251b62))
* **mobile:** :bug: adjust session listening logic ([782645f](https://gitee.com/llangkebo/hula/commit/782645fb8ea6dd087c14c7da17eb616941c37d92))
* **mobile:** :bug: fix bubble width, scroll, and SVG color ([c1ce99e](https://gitee.com/llangkebo/hula/commit/c1ce99e8d1068f796856132728e9c193c1afc465))
* **mobile:** :bug: fix style display issues ([124a3c0](https://gitee.com/llangkebo/hula/commit/124a3c03460eb6541bce83a21ad0f61701ef7db9))
* **mobile:** :bug: fixed background image issue ([0dfc96f](https://gitee.com/llangkebo/hula/commit/0dfc96f6e5c95f682e9c7bb502917ce0d645ef3f))
* **mobile:** :bug: preliminary fix for logout issue; fixed issue of friends not loading ([53f80c5](https://gitee.com/llangkebo/hula/commit/53f80c5069681e16e5293d7912dee0718a5f6cdc))
* **readme:** :bug: fix readme file not showing issue ([4df4fd9](https://gitee.com/llangkebo/hula/commit/4df4fd95ca366f56883a967d4cf507c8b6bd671d))
* **store:** :bug: adjust session switching and announcement listening location ([7c1d2cf](https://gitee.com/llangkebo/hula/commit/7c1d2cf3b2be474550071bdf34da6becf6bdc705))
* **transmit:** :bug: fix forwarding function can not be used ([ae86ee3](https://gitee.com/llangkebo/hula/commit/ae86ee3a1f8dd2b7b9536a86129175c0519283ed))
* **update:** :bug: fix forced updates in development environments ([e40dd5a](https://gitee.com/llangkebo/hula/commit/e40dd5a01f9d6a90f902363bfc3620226bc93b74))
* **view:** :bug: display announcement ([fe9f228](https://gitee.com/llangkebo/hula/commit/fe9f228426b66f8ac0b50c413e97ab3e1c7fc415))

## [3.0.1](https://gitee.com/llangkebo/hula/compare/v3.0.0...v3.0.1) (2025-10-21)


### ✨ Features | 新功能

* **mobile:** :sparkles: add new model processing file for android ([7f729c0](https://gitee.com/llangkebo/hula/commit/7f729c09a2cbb9092e1dd61686deae122bb9aa42))
* **mobile:** :sparkles: new Mobile Terms Page ([76f2c28](https://gitee.com/llangkebo/hula/commit/76f2c28e3d59df564d0ffcb661bf461ece177083))


### 🐛 Bug Fixes | Bug 修复

* **assistant:** :bug: fix document not opening problem ([60f4c9d](https://gitee.com/llangkebo/hula/commit/60f4c9dc161c1deb2e1e036d1ada0e6c7719fcc1))
* **bot:** :bug: assistant sorting problem ([89305ee](https://gitee.com/llangkebo/hula/commit/89305ee8af5be8daaca611d21586f19a83ac0ec0))
* **common:** :bug: adjust announcement logic ([8e6bc85](https://gitee.com/llangkebo/hula/commit/8e6bc85ac4327672cb25e2a8cf272e3893a6f634))
* **common:** :bug: adjust the logic for marking messages as read ([9e82cd6](https://gitee.com/llangkebo/hula/commit/9e82cd618b4af0b57f9f33d3a5a3fed030bd15b3))
* **common:** :bug: fix bg color ([e47c80e](https://gitee.com/llangkebo/hula/commit/e47c80ebcdbb91beb331b0214bbedc6dd73ebb41))
* **common:** :bug: login bg pic ([466e46d](https://gitee.com/llangkebo/hula/commit/466e46d38be0567a1095b7e551350f764c627b58))
* **mobile:** :bug: fix the registration popup issue ([585d0b7](https://gitee.com/llangkebo/hula/commit/585d0b7c732db904c4fa77a62f74d3fd335b7aed))
* **store:** :bug: set group admin ([96bfa9e](https://gitee.com/llangkebo/hula/commit/96bfa9e2e5cda9a7d07aa5b7ab398121758093fc))
* **video:** :bug: fix video not playing problem ([1ecb58d](https://gitee.com/llangkebo/hula/commit/1ecb58d6d1c30bf072de1c5679b6e43d0ed76b44))

## [3.0.0](https://gitee.com/llangkebo/hula/compare/v2.6.13...v3.0.0) (2025-10-20)


### ✨ Features | 新功能

* **bot:** :sparkles: add built-in webview for hula rendering content ([7007662](https://gitee.com/llangkebo/hula/commit/70076622e518339d75287aebc6f56a29cfa26880))
* **bot:** :sparkles: add content displayed by Assistant user type ([3238e5a](https://gitee.com/llangkebo/hula/commit/3238e5a51ed6d281d67275d3e0275d739ecc0009))
* **bot:** :sparkles: add preview 3D models ([8015bf9](https://gitee.com/llangkebo/hula/commit/8015bf925c7dc98f4ebd993d8f2d4a6f394c5cb2))
* **common:** :sparkles: create MobileLayout ([f88db9e](https://gitee.com/llangkebo/hula/commit/f88db9eafc0410300a80005fbcc6b28356a7dcda))
* **common:** :sparkles: mediaViewer ([e2148a0](https://gitee.com/llangkebo/hula/commit/e2148a0fc3e5b2e11e9a0016eeb0b45f94a6da5a))
* **common:** :sparkles: mobile image review ([fa2cab3](https://gitee.com/llangkebo/hula/commit/fa2cab3e7eb83a55c76ae38f4d9a80b03d1983a9))
* **common:** :sparkles: optimize the mobile experience and some styles ([#348](https://gitee.com/llangkebo/hula/issues/348)) ([35f0d2a](https://gitee.com/llangkebo/hula/commit/35f0d2a43cb3f38dafe1d90649ccd295f3d98b9d))
* **common:** :sparkles: scan login and notification counter ([cf9dbdf](https://gitee.com/llangkebo/hula/commit/cf9dbdff1914a70fa0b8ecff038fb7d139a0aa1d))
* **common:** :sparkles: searchChatContent ([d58eee3](https://gitee.com/llangkebo/hula/commit/d58eee3be857fccb254a48d29b7dee47519dc9c0))
* **common:** :sparkles: ws ack ([4731392](https://gitee.com/llangkebo/hula/commit/4731392ebb913cc0384b12491424ce6de0b2db40))
* **common:** ✨ add positioning and file management functions ([#344](https://gitee.com/llangkebo/hula/issues/344)) ([8082370](https://gitee.com/llangkebo/hula/commit/80823706d9404c39ece9fbb703abd1fd75eff76f)), closes [#212](https://gitee.com/llangkebo/hula/issues/212)
* **common:** ✨ sqlite 本地存储 ([#305](https://gitee.com/llangkebo/hula/issues/305)) ([49aef65](https://gitee.com/llangkebo/hula/commit/49aef65e5c6c330f41ac04efee363a9680b2be71))
* **conversation:** :sparkles: enhance right-click border effect ([3b2ed4d](https://gitee.com/llangkebo/hula/commit/3b2ed4dcd2cda46dbdb05ab0ebdc43cc22bacd8f))
* **file manage:** :sparkles: init file manage ([85fb0c5](https://gitee.com/llangkebo/hula/commit/85fb0c50fc455ca621d972450671c555fc585836))
* **function:** :sparkles: add screenshot assistance function, and enhanced guidance function ([4b0f170](https://gitee.com/llangkebo/hula/commit/4b0f17035f3e452a1218740fa7bf3f6550dbbfff))
* **guidance:** :sparkles: add novice guide ([ef82ba8](https://gitee.com/llangkebo/hula/commit/ef82ba851f36186af1cdb5b50a0e8790fd4a0be8))
* **historical news:** :sparkles: add History Message Management ([09535c4](https://gitee.com/llangkebo/hula/commit/09535c42e0ba54ea31d786757c24c9c8e9932991))
* **location:** :sparkles: add connect tencent map api ([e4739b0](https://gitee.com/llangkebo/hula/commit/e4739b08209f89293c3ae14d2a66526141774213))
* **location:** :sparkles: add positioning function ([1f10a82](https://gitee.com/llangkebo/hula/commit/1f10a825d27fb39573a1be614873deaeb7211b56))
* **merger news:** :sparkles: add merge message forwarding ([19a0471](https://gitee.com/llangkebo/hula/commit/19a0471df753526380ac9b8cd1581ac3b8af09b8))
* **mobile:** :sparkles: add 'voice' and 'More' panel ([4766e12](https://gitee.com/llangkebo/hula/commit/4766e12703538cc2967cc71962d56eabacfc7e8d))
* **mobile:** :sparkles: add a 'Forgot Password' page and fix the input field height issue ([6684887](https://gitee.com/llangkebo/hula/commit/66848871443d008fc474b98dca75835e49be9158))
* **mobile:** :sparkles: add new “Do Not Disturb” feature ([1732f6d](https://gitee.com/llangkebo/hula/commit/1732f6d8d48ff348abf7938704354e331fc5c6b4))
* **mobile:** :sparkles: add new dependencies ([ced68f8](https://gitee.com/llangkebo/hula/commit/ced68f8ce1f1e344335a2fcd95b3f5ae3c6f7a7f))
* **mobile:** :sparkles: add new permission request ([11b239a](https://gitee.com/llangkebo/hula/commit/11b239a9a933c625c8524b7c1d1a62d393013224))
* **mobile:** :sparkles: add qr-code type ([1769aad](https://gitee.com/llangkebo/hula/commit/1769aade2cdf5ce00796b04312ad34cb8cf98f20))
* **mobile:** :sparkles: add qs-code event ([9ffa7d4](https://gitee.com/llangkebo/hula/commit/9ffa7d41da06de690845cfebd29873fc1907eb51))
* **mobile:** :sparkles: add Scan-to-Login Feature ([0c80384](https://gitee.com/llangkebo/hula/commit/0c8038482d15530e2a9de4565bbc0a7804b19bd2))
* **mobile:** :sparkles: added avatar online status; enhanced WebSocket event handling ([c974afa](https://gitee.com/llangkebo/hula/commit/c974afa811024ee9121243f20e99cb118ae8536f))
* **mobile:** :sparkles: added click-to-open image message feature ([a32f186](https://gitee.com/llangkebo/hula/commit/a32f18688aa5eb5917a5547a5b744c1ce01cbfa9))
* **mobile:** :sparkles: added group member avatar/name data; fixed my message display issue ([1d15292](https://gitee.com/llangkebo/hula/commit/1d15292a81e962fe21106dcb19ddd85ed968a302))
* **mobile:** :sparkles: added message count on mobile ([b115cc9](https://gitee.com/llangkebo/hula/commit/b115cc9eac42002224d82a28becb8587bc29c7bd))
* **mobile:** :sparkles: added QR code friend-adding feature ([7ddfbab](https://gitee.com/llangkebo/hula/commit/7ddfbabb44c0239821995c29fbaa86590a431f30))
* **mobile:** :sparkles: improve the 'More' feature menu in the chatroom ([56f9ab3](https://gitee.com/llangkebo/hula/commit/56f9ab3bcc80fa7a3b87ee46d20f0819bc561f4a))
* **mobile:** :sparkles: modify the mobile footer bar ([8412b5a](https://gitee.com/llangkebo/hula/commit/8412b5a621eb03eff4e7f5a0dff3e2ae8f82dd23))
* **mobile:** :sparkles: optimize mobile style and functionality ([#355](https://gitee.com/llangkebo/hula/issues/355)) ([ae144b6](https://gitee.com/llangkebo/hula/commit/ae144b6e55aae1b005c664103423ff87bcfe6534))
* **mobile:** :sparkles: optimize the effects and functions of the chatroom input box ([5e54106](https://gitee.com/llangkebo/hula/commit/5e5410635d07188fb463aaf0c9a534401d0bcb4e))
* **mobile:** :sparkles: replace the log-out confirmation dialog ([3dc77df](https://gitee.com/llangkebo/hula/commit/3dc77df4524efa3c222b3be7c0620537e87004a8))
* **mobile:** ✨ add and improve mobile ([#328](https://gitee.com/llangkebo/hula/issues/328)) ([9a342f7](https://gitee.com/llangkebo/hula/commit/9a342f7804f24ea5d8d14e31b0f388ba4f2bc2d7))
* **mobile:** ✨ add mobile compatibility ([#332](https://gitee.com/llangkebo/hula/issues/332)) ([1b0e31d](https://gitee.com/llangkebo/hula/commit/1b0e31d06b7310b3264eff58b350f118a4b00e77))
* **screenshot:** :sparkles: add screenshots of rounded corners and write input box ([0ccedaf](https://gitee.com/llangkebo/hula/commit/0ccedafdb61eae9d3f40fc16bf9da41011682a69)), closes [#323](https://gitee.com/llangkebo/hula/issues/323)
* **setting:** ✨ 增加应用占用磁盘空间计算功能和可视化 ([#303](https://gitee.com/llangkebo/hula/issues/303)) ([d8caa5a](https://gitee.com/llangkebo/hula/commit/d8caa5a4313774f6ae2e22b006849d96efd733e2))
* **shortcut:** :sparkles: add global shortcut key switch ([1572490](https://gitee.com/llangkebo/hula/commit/15724906200bda918666a3c71efd1954f1efb843))
* **shortcut:** ✨ add mobile pages and scanning plug-ins ([#319](https://gitee.com/llangkebo/hula/issues/319)) ([27f1545](https://gitee.com/llangkebo/hula/commit/27f15453051e81316b508884e4a259b0decad190))
* **shortcut:** ✨ add shortcut keys, screenshots and voice, video calls ([3ab5b0b](https://gitee.com/llangkebo/hula/commit/3ab5b0bdbb9ba8cf92a0db851d34114977b0218d))
* **shortcut:** ✨ increased mobile compatibility (60%) ([#315](https://gitee.com/llangkebo/hula/issues/315)) ([a05ebce](https://gitee.com/llangkebo/hula/commit/a05ebcef575a881063073d9ec926e8fb5d372eb9)), closes [#ICT1](https://gitee.com/llangkebo/hula/issues/ICT1)
* **system:** ✨ 增加分布式兼容和语音视频通话、移动端部分兼容 ([#311](https://gitee.com/llangkebo/hula/issues/311)) ([ac3dac3](https://gitee.com/llangkebo/hula/commit/ac3dac35a397d627affe283723a1622cfe8b881b)), closes [#IBQB1](https://gitee.com/llangkebo/hula/issues/IBQB1) [#ICT1](https://gitee.com/llangkebo/hula/issues/ICT1)
* **view:** ✨ 新增文件预览功能 ([#301](https://gitee.com/llangkebo/hula/issues/301)) ([19e6a15](https://gitee.com/llangkebo/hula/commit/19e6a15ad0bab88f97b9ce746ed8e96b12f544a5))
* **views:** :sparkles: add protocol window ([dc16505](https://gitee.com/llangkebo/hula/commit/dc16505d7812c3b3686a932aa7cebc02c013508e))
* **voice:** :sparkles: add voice progress dragging ([fd175a5](https://gitee.com/llangkebo/hula/commit/fd175a53d1e24e42a104711fe4b23595317ce656))
* **windows:** add NSIS installer packaging with uninstall logo support ([abdbbd7](https://gitee.com/llangkebo/hula/commit/abdbbd7c95ff258fe2a0c92ea9ea592fb15f4d11))


### 🐛 Bug Fixes | Bug 修复

* **Android:** :bug: fix startup failure due to platform judgment during startup ([e173978](https://gitee.com/llangkebo/hula/commit/e17397881f16901a9d303ebdb026e5a36d09b172))
* **bar:** :bug: fix bar and some mobile style issues ([1ddb855](https://gitee.com/llangkebo/hula/commit/1ddb855c2aa75ccaf0e422cc1c0433eb0c7efa80))
* **chatbox:** :bug: fix n-split with extra height ([3a199b3](https://gitee.com/llangkebo/hula/commit/3a199b3dd9f5f5ae6430ce0a69020139f98fdef6))
* **common:** :bug: a change group myname and B can't see that issue ([7c957d0](https://gitee.com/llangkebo/hula/commit/7c957d0e8772146bc60418815a43a1ca8b77504f))
* **common:** :bug: abutment ack ([00b10fb](https://gitee.com/llangkebo/hula/commit/00b10fbffe87cefe364027557ad4e1461bfbf4cf))
* **common:** :bug: add chatStore.clearRedundantMessages ([fd54337](https://gitee.com/llangkebo/hula/commit/fd54337364a8e7584123e6eb6f77b5de94d4968c))
* **common:** :bug: add fingerprint information to the login interface ([f698d3f](https://gitee.com/llangkebo/hula/commit/f698d3fae58b51155a2b514ca7c68c028a524341))
* **common:** :bug: add scanning flag ([f00534e](https://gitee.com/llangkebo/hula/commit/f00534e5441f51de3095ee8d9ab699e111895ab5))
* **common:** :bug: add session when join group ([99f5dc2](https://gitee.com/llangkebo/hula/commit/99f5dc23e62680b214c10cd3e768bb99c4a2877b))
* **common:** :bug: add session when join group; pop email code input in register windows ([aa0afbd](https://gitee.com/llangkebo/hula/commit/aa0afbd4eb4205a0f1dd0533368ebdcc51e5873c))
* **common:** :bug: android keybord ([717ddcf](https://gitee.com/llangkebo/hula/commit/717ddcf7b49ef4c04ff380a1503c9c0ff7c278f4))
* **common:** :bug: announcement time issue ([9bbaa32](https://gitee.com/llangkebo/hula/commit/9bbaa320bfac8e71ee4840eeefbc038be199abdd))
* **common:** :bug: apply issue ([#318](https://gitee.com/llangkebo/hula/issues/318)) ([2ac3568](https://gitee.com/llangkebo/hula/commit/2ac3568d15e6eceb2ebf7f2adeb9c17a12020fe0))
* **common:** :bug: auto login ([171076c](https://gitee.com/llangkebo/hula/commit/171076c8da084facd256e2a1f92fff9af1d96132))
* **common:** :bug: auto login issue ([b86eb5a](https://gitee.com/llangkebo/hula/commit/b86eb5a1f8b50c841ad739c55eae8bb805e2fcbb))
* **common:** :bug: autoFixHeightPage useage ([c29201c](https://gitee.com/llangkebo/hula/commit/c29201c012e68c1eeb8af3bd2974dfe98e22e866))
* **common:** :bug: autoFixHeightPage.vue ([dbad023](https://gitee.com/llangkebo/hula/commit/dbad0233b588684752366a77c92733c21e64732b))
* **common:** :bug: badge display ([1b086b9](https://gitee.com/llangkebo/hula/commit/1b086b97595c58d90d76ed189bc98b1214d328ba))
* **common:** :bug: change group member count ([f74fcc0](https://gitee.com/llangkebo/hula/commit/f74fcc0afbd0d4f60d338caf57abceb707cd6c06))
* **common:** :bug: change init msg lenth ([fc69d6b](https://gitee.com/llangkebo/hula/commit/fc69d6b40fe1e10a0d5a9b8713a16603dd134b65))
* **common:** :bug: change my group user info ([a3d2425](https://gitee.com/llangkebo/hula/commit/a3d24252454f7a4906f52a1e13bba605e8ac3967))
* **common:** :bug: chatSetting display ([b1e0af7](https://gitee.com/llangkebo/hula/commit/b1e0af78f126e8db7f38a0b66f8b75cceae79cd5))
* **common:** :bug: clear msg check ([f26cf2c](https://gitee.com/llangkebo/hula/commit/f26cf2c759d6c775a68a6dd32f1b797ac098082a))
* **common:** :bug: compatibility administrator ([6c09d33](https://gitee.com/llangkebo/hula/commit/6c09d33c5bab97473f23739c5afd511bde004ecb))
* **common:** :bug: delete announcement error ([de5ad5a](https://gitee.com/llangkebo/hula/commit/de5ad5a8ed19e1a63eba36d15bf5cc4f7d0768a6))
* **common:** :bug: delete useless code; fix session change ([cac88a7](https://gitee.com/llangkebo/hula/commit/cac88a7853c78afd66604920e68997690aaa796e))
* **common:** :bug: desktop line break ([a93970d](https://gitee.com/llangkebo/hula/commit/a93970d3da398caa2e9c4879a49cdc25c93f0a1f))
* **common:** :bug: display error msg when login error ([a108333](https://gitee.com/llangkebo/hula/commit/a1083337686a55ad75ba11aa1985425e5e34e255))
* **common:** :bug: display friend contact error when friend delete ([eacd91b](https://gitee.com/llangkebo/hula/commit/eacd91b8ff6a60e2b71d68a28d7b67d0c1e3baf1))
* **common:** :bug: dissolve group if dissolved and switch to first session ([e843675](https://gitee.com/llangkebo/hula/commit/e843675daf72e9c4c9d74c4a0c35602e1c9c49e4))
* **common:** :bug: fix compile error ([de5fd7d](https://gitee.com/llangkebo/hula/commit/de5fd7da368c26dc15caeede9a06a493caded100))
* **common:** :bug: fix display the name of the msg in chatbox ([3de7bb2](https://gitee.com/llangkebo/hula/commit/3de7bb203439947d655b1453ac9f2c9f784c3b4b))
* **common:** :bug: fix mobile logout problem ([80ce0de](https://gitee.com/llangkebo/hula/commit/80ce0de82991de86b6887ea7a7e87c1396ee863f))
* **common:** :bug: fix some defects and improve mobile terminal ([#335](https://gitee.com/llangkebo/hula/issues/335)) ([d2be80a](https://gitee.com/llangkebo/hula/commit/d2be80a5db379f4d8cc8e8a5f778bc16c33cdf1c))
* **common:** :bug: fix some personal information styles ([b53abbd](https://gitee.com/llangkebo/hula/commit/b53abbd58049008e7172db25088310ed72cdd06a))
* **common:** :bug: fix some styles and initialization login error ([ecd27d8](https://gitee.com/llangkebo/hula/commit/ecd27d8e4f01ca86c77ecd105aa0b6a2012290ed))
* **common:** :bug: friend note was modified ([949b527](https://gitee.com/llangkebo/hula/commit/949b5278cd7fe09dfc96792277483169085e3466))
* **common:** :bug: get group chats automatically when no group exists ([deb0916](https://gitee.com/llangkebo/hula/commit/deb0916869a48cf3e2f303a985d45f9e8c2c76d1))
* **common:** :bug: group administrators set notifications ([de145aa](https://gitee.com/llangkebo/hula/commit/de145aacac2d8e50e96015b1a24c9b2af1c4a29d))
* **common:** :bug: group chat hide rtc call ([f36b51f](https://gitee.com/llangkebo/hula/commit/f36b51f8e0f7b62310cf2228999c17de3fada4ab))
* **common:** :bug: group info change ([c7330dc](https://gitee.com/llangkebo/hula/commit/c7330dca21dcd4d14316c64eccad345bef976a92))
* **common:** :bug: handle request 401 error ([f7f18c1](https://gitee.com/llangkebo/hula/commit/f7f18c16d4b445df603381504da6c39732238022))
* **common:** :bug: ios soft keybord hide tool box ([c822deb](https://gitee.com/llangkebo/hula/commit/c822deb689fd1de5dfc93b1b98922ccf7fcc0dc0))
* **common:** :bug: last msg error ([bedf11b](https://gitee.com/llangkebo/hula/commit/bedf11b3e8d100ab345aa421fa96775f79579166))
* **common:** :bug: lazy change user item when click group member ([a835198](https://gitee.com/llangkebo/hula/commit/a835198e90c4da513dc61a19f153d2e7447e4679))
* **common:** :bug: logout notify when other login ([e3330e9](https://gitee.com/llangkebo/hula/commit/e3330e9d7ffb9a4d653ccae9027697c9c5841af5))
* **common:** :bug: mobile bg issue ([abc0078](https://gitee.com/llangkebo/hula/commit/abc007815064e7ca1e6142d8e17c3fcddc6b781d))
* **common:** :bug: mobile bg-color ([fdcd40b](https://gitee.com/llangkebo/hula/commit/fdcd40b978fc2fb5baa72778d376d2da9c4323ea))
* **common:** :bug: mobile msg input ([182f830](https://gitee.com/llangkebo/hula/commit/182f830782f8330e5f7b34df83f46c905833eada))
* **common:** :bug: mobile msg input focus after msg send ([728f4b9](https://gitee.com/llangkebo/hula/commit/728f4b98f6e94b6d96f53b1ea3ec766e7842982a))
* **common:** :bug: mobile scan qrcode page ([4e18237](https://gitee.com/llangkebo/hula/commit/4e18237d47a8270bd30eabe1daffb56e3d93bf06))
* **common:** :bug: mobile video call switch video direction ([6f0ce82](https://gitee.com/llangkebo/hula/commit/6f0ce8264dffd960f5bb9f383659f529c1e597a6))
* **common:** :bug: msg list interface pass {} when data is Non ([a7d3c93](https://gitee.com/llangkebo/hula/commit/a7d3c93dee745cdcbede2e4c7083a56954a829b0))
* **common:** :bug: msg mark ([cb82ec2](https://gitee.com/llangkebo/hula/commit/cb82ec2b0e9740074b03b526c1f94303247a9059))
* **common:** :bug: my group user info ([ddd29d6](https://gitee.com/llangkebo/hula/commit/ddd29d6dbbcfaaad34606401b2239f810eb6152a))
* **common:** :bug: notification display mode of the group ([4dfb775](https://gitee.com/llangkebo/hula/commit/4dfb77593857ce9d5b70c404644566cadf0e57fe))
* **common:** :bug: optimize scan interaction logic ([8355d10](https://gitee.com/llangkebo/hula/commit/8355d109645a041ee86945c7a5be5b11d5e480f8))
* **common:** :bug: optimize the message withdrawal logic ([df11073](https://gitee.com/llangkebo/hula/commit/df110737b52a37a7e163720b008f838fbc18514b))
* **common:** :bug: parsing the time, it is strongly converted to a number type ([6a87411](https://gitee.com/llangkebo/hula/commit/6a87411360837565b35cc567e9b26d4c0257befc))
* **common:** :bug: qrcode scan login ([ae29ac0](https://gitee.com/llangkebo/hula/commit/ae29ac0a5cd7f3ed5291e59df2fc72e8f7ff7b59))
* **common:** :bug: recall msg and re-edit ([bfd5357](https://gitee.com/llangkebo/hula/commit/bfd53574c53141180cd78b8568b19bdb1bfafbd6))
* **common:** :bug: register bug ([f9fdf98](https://gitee.com/llangkebo/hula/commit/f9fdf98fffdca890d30e01e21c3534ffe9af9fb2))
* **common:** :bug: remove captcha ([627e07a](https://gitee.com/llangkebo/hula/commit/627e07a1127108a56913f6ae01ac452a638435f6))
* **common:** :bug: remove friend request ([b9b8419](https://gitee.com/llangkebo/hula/commit/b9b8419256faf592d6d4c52c2a11bd21c9cc7615))
* **common:** :bug: remove group member issue ([640f9d7](https://gitee.com/llangkebo/hula/commit/640f9d7c2ff7d254d1d7296463db0e6e64756761))
* **common:** :bug: rename mobile Voice to VoicePanel ([69fdbbb](https://gitee.com/llangkebo/hula/commit/69fdbbb47eeb058d3db1039680c6a6916b2b1f54))
* **common:** :bug: reply message display error ([403d129](https://gitee.com/llangkebo/hula/commit/403d129083011db05986eb6bb34f8d18ab3d7a8d))
* **common:** :bug: scroll msg ([3356fe6](https://gitee.com/llangkebo/hula/commit/3356fe6865825c7d44355bbde72addf97c7e1bed))
* **common:** :bug: scroll to bottom when msg list change ([4cb4eba](https://gitee.com/llangkebo/hula/commit/4cb4ebaaa59682a06990a6c5811dc36c58f4c5ed))
* **common:** :bug: search user in group ([5bc51d9](https://gitee.com/llangkebo/hula/commit/5bc51d9be7ecd9c36b2a3f4421742b7ceddc21a6))
* **common:** :bug: set model window closeable in register window ([9e4c179](https://gitee.com/llangkebo/hula/commit/9e4c17983c0c76a1cb8f6e978d79bdbfd94e680a))
* **common:** :bug: unified monitoring messages and resolve group creation white screen ([3b472d4](https://gitee.com/llangkebo/hula/commit/3b472d4f6d7d4ce220b89ad86843e804e645e266))
* **common:** :bug: update group contact when self group change ([8e051aa](https://gitee.com/llangkebo/hula/commit/8e051aa44f20b675e64e1208e0778f39675876c5))
* **common:** :bug: update group count ([34a9321](https://gitee.com/llangkebo/hula/commit/34a932100fa249bc01417cb6073f1fa4f50d0563))
* **common:** :bug: update my group info ([5ab052c](https://gitee.com/llangkebo/hula/commit/5ab052c74047a456df53709ee211bd0ce7bdbe49))
* **common:** :bug: update session name when change the group room remark ([623101a](https://gitee.com/llangkebo/hula/commit/623101a7981a77932373ac7bdddfead40cd506ec))
* **common:** :bug: update the display username of the msg when my group userinfo change ([a49502b](https://gitee.com/llangkebo/hula/commit/a49502b9fb5558a9e15a38fcbc3bc1443c502bca))
* **common:** :bug: update user state ([0b20ca2](https://gitee.com/llangkebo/hula/commit/0b20ca23d2da900628e41f2eb10712e3caba835d))
* **common:** :bug: webrtc candidate exchange ([f67ff5f](https://gitee.com/llangkebo/hula/commit/f67ff5f42dc170454f97923480da6741bcf7700e))
* **common:** :bug: webrtc issue ([368f7f8](https://gitee.com/llangkebo/hula/commit/368f7f84feada274742d8cf6dc6aeeed859459af))
* **common:** :bug: webrtc issue ([a9058a5](https://gitee.com/llangkebo/hula/commit/a9058a5aa3035bf87771f673e9acb3c1438fa0ab))
* **common:** :bug: webrtc listener ([7844dc2](https://gitee.com/llangkebo/hula/commit/7844dc2d78375aea38d2820f240093d65b6894fa))
* **common:** :bug: webrtc send ice candidate issue ([b6652fb](https://gitee.com/llangkebo/hula/commit/b6652fb787d983f8431309e3e962c1d7a29c7be1))
* **common:** :bug: websocket reconnect ([e540e9a](https://gitee.com/llangkebo/hula/commit/e540e9a2966c70df26cf02735788e90b842453cf))
* **component:** :bug: 修复录音取消后线程内没有被取消导致另外会话录音失败 ([2a96881](https://gitee.com/llangkebo/hula/commit/2a9688180e845ef655725e3b57b4cbaa29c9c97b))
* **component:** :bug: 修复消息标记不显示问题 ([3b6469c](https://gitee.com/llangkebo/hula/commit/3b6469c58014253debce464dc2ff141b2a9b2f45))
* **config:** :bug: fix some configuration issues on windows ([9006441](https://gitee.com/llangkebo/hula/commit/90064415c6010712625c26cdf7894bdbaffbdb30))
* **doc:** :bug: fix document jump problem ([84422bf](https://gitee.com/llangkebo/hula/commit/84422bfbf841a8b0af2daade41418c08d55f5d44))
* **DPR:** :bug: fix popover offset issues and scaling issues at high multiples ([d904845](https://gitee.com/llangkebo/hula/commit/d90484579e06d8f8a9c26bb371df029e431caf00))
* **DPR:** :bug: fix resolution and zoom factor affected due to text size zoom ([1986eec](https://gitee.com/llangkebo/hula/commit/1986eec6d96d73ee0b76d8b1f600ba388ac69e0d))
* **history:** :bug: fix history manager unable to open pictures and videos ([1cef301](https://gitee.com/llangkebo/hula/commit/1cef3017b69f079728e6348a32e0469c96e598c1))
* **history:** :bug: fix history window content not wrapping ([d66c1b6](https://gitee.com/llangkebo/hula/commit/d66c1b6086e920688b9e07e25f6d0518dd9c59a6))
* **history:** :bug: fix issues such as not being able to view pictures and videos in history ([a08da0d](https://gitee.com/llangkebo/hula/commit/a08da0df4bd01f7f044fd235bdc0f6081ca6c3c6))
* **input:** :bug: fix some logic errors sent by pc input box ([5e61381](https://gitee.com/llangkebo/hula/commit/5e6138162c16186df3c084eb180365005051d6aa))
* **layout:** :bug: fix import issue in voicepanel component ([c0526f2](https://gitee.com/llangkebo/hula/commit/c0526f235b8bebc35820da144de5800e267f04f2))
* **layout:** :bug: fix layout drag zoom out abnormal issue ([d45bec2](https://gitee.com/llangkebo/hula/commit/d45bec22d2c0ce5437388f1bbf74685f124d2105))
* **list:**  fix some existing problems ([e381165](https://gitee.com/llangkebo/hula/commit/e38116529a4bc5869ea50505bd43fec0d7ea7584))
* **list:** :bug: fix message list not bottomed out ([0834eb8](https://gitee.com/llangkebo/hula/commit/0834eb8f87baee65ac2c98039c4ca2ebcedd77c6))
* **login:** :bug: fix automatic login logic issues ([d9e6024](https://gitee.com/llangkebo/hula/commit/d9e6024b66e3a7db137f707f84d55a65b15dd443))
* **mac:** :bug: fix issues caused by resolution ([4e9f7cf](https://gitee.com/llangkebo/hula/commit/4e9f7cf32278b9c813f33e4803d88ec92e4e228e))
* **mobile audio:** :bug: fix mobile audio issues ([a4a3ace](https://gitee.com/llangkebo/hula/commit/a4a3ace30cf6e976a64358ddf53192736a18858c))
* **mobile:** :bug: fix chat room height and pull-to-refresh issues ([2305cd8](https://gitee.com/llangkebo/hula/commit/2305cd8e307387223be459e99436859640049191))
* **mobile:** :bug: fix duplicate trigger count and ring tone in mobile session list ([682c56c](https://gitee.com/llangkebo/hula/commit/682c56c6296436e48b1bd63dfae5542278183fa1))
* **mobile:** :bug: fix error when mobile receives message ([ba55a2f](https://gitee.com/llangkebo/hula/commit/ba55a2f7df96d238b2219ed87fb70cae608f6f94))
* **mobile:** :bug: fix HMR address config in Vite ([4f0096e](https://gitee.com/llangkebo/hula/commit/4f0096ec8478379f8d100cf84d0c5b97f56bfdd2))
* **mobile:** :bug: fix HMR address config in Vite ([e38ecb7](https://gitee.com/llangkebo/hula/commit/e38ecb79df517f09ea214401bead552c7b0ec539))
* **mobile:** :bug: fix some known issues ([#353](https://gitee.com/llangkebo/hula/issues/353)) ([542760b](https://gitee.com/llangkebo/hula/commit/542760be0e3e10d6f07d490edb3b826f1729c840))
* **mobile:** :bug: fix style issues, create group chats, and resolve logout problems ([2b1cdec](https://gitee.com/llangkebo/hula/commit/2b1cdec9da97b6584c6cd9fd28051945a7afce23))
* **mobile:** :bug: fix the 'System Type Error' issue in the registry ([5671334](https://gitee.com/llangkebo/hula/commit/56713345ef63e2f76651d6cd614d95cac60c2a37))
* **mobile:** :bug: fix the input box and panel display functionality on mobile devices ([36e7aef](https://gitee.com/llangkebo/hula/commit/36e7aef3b9d5d8353130e33ad3456aafc1b9577b))
* **mobile:** :bug: fix the issue where messages can't wrap to the next line ([594ba26](https://gitee.com/llangkebo/hula/commit/594ba26b43a800c5149d6e9c1304cb45bc867dfe))
* **mobile:** :bug: fix the issue where the message list page cannot scroll ([b1d0aff](https://gitee.com/llangkebo/hula/commit/b1d0affb189738ef948eb42ce24d8cd40954848f))
* **mobile:** :bug: fix unimported dependencies ([cb7f271](https://gitee.com/llangkebo/hula/commit/cb7f27160afe6a89cb700213d577eb75b09b90c6))
* **mobile:** :bug: fix white screen when returning from group notice page; fix wrong route name ([211df23](https://gitee.com/llangkebo/hula/commit/211df23e8a02d97a77f48720386a453a8205b622))
* **mobile:** :bug: fixed message avatar display issue in friends list ([78ba51c](https://gitee.com/llangkebo/hula/commit/78ba51c5dd8c7d4feacba1781864ca205cf79145))
* **mobile:** :bug: remove animation, fix mobile styles ([893df8a](https://gitee.com/llangkebo/hula/commit/893df8ac41ba9ba9b4695f84c623949adb288ee7))
* **not mac:** :bug: fix startup error for platforms other than mac ([58e284c](https://gitee.com/llangkebo/hula/commit/58e284cd22a73acb5a807279b264d48af1512f04))
* **pc:** :bug: fix update issue of my group nickname and comments in pc ([6f9d766](https://gitee.com/llangkebo/hula/commit/6f9d766d81f4ba922e61c9392bca020a15d38bdf))
* **plug-in:** :bug: modify plug-in styles ([3a05ec3](https://gitee.com/llangkebo/hula/commit/3a05ec3e05a75bc883c0e5741a471761181d373d))
* **router:** :bug: fix white screen on mobile terminal caused by routing ([300860c](https://gitee.com/llangkebo/hula/commit/300860cda4fa05f806c42286f2b1b5fea7a108c6))
* **rust:** :bug: fix mobile startup error ([43b52cd](https://gitee.com/llangkebo/hula/commit/43b52cd6e2fe1ac34d6d5190b0b1d3f06bb7ef96))
* **rust:** :bug: fix startup warning issue ([9f5486d](https://gitee.com/llangkebo/hula/commit/9f5486d4152429d34c4ff1992cff61bb81001f64))
* **system:** :bug: 修复打包安装启动不成功问题 ([fe37c24](https://gitee.com/llangkebo/hula/commit/fe37c246777cde3325555ed2ba2fcf860888a4a8))
* **system:** :bug: fix an issue where scrolling bars could appear in windows ([0ee589b](https://gitee.com/llangkebo/hula/commit/0ee589b35053fb4faa66cfb9cd9dd14a447ab80a))
* **system:** :bug: fix app content becoming larger due to system enlargement ([a7768aa](https://gitee.com/llangkebo/hula/commit/a7768aa3b1639145c5c5008d3714014368f5b288)), closes [#324](https://gitee.com/llangkebo/hula/issues/324)
* **system:** :bug: modify some styles and fix lock screen, home search function ([959a43e](https://gitee.com/llangkebo/hula/commit/959a43ecf07db16e604b10a9f2acf69708f4d42f))
* **tray:** :bug: fix tray prompt issues ([cbeee6d](https://gitee.com/llangkebo/hula/commit/cbeee6d96fd5704927d27ef30595b0a90782b801))
* **validate:** correct password special character regex in login, register and reset pages ([6235a0a](https://gitee.com/llangkebo/hula/commit/6235a0ad24eb61377c328187fbc05bf0784dad95))
* **view:** :bug: fix QR code login issue ([d05541e](https://gitee.com/llangkebo/hula/commit/d05541e6c7a88d8030f78aa747c9a0c43e7049f2))
* **view:** :bug: fixed session right-click switch room status sidebar settings not synchronized ([98f10bd](https://gitee.com/llangkebo/hula/commit/98f10bdefa7791231d49e42c3e2d6897b1807625))
* **views:** :bug: fix ip and screenshot issues ([28f1f70](https://gitee.com/llangkebo/hula/commit/28f1f701fbdc200185962d6b3cd775e738eafbad))
* **vitest config:** :bug: fix problems caused by inconsistent vitest configuration ([28043f5](https://gitee.com/llangkebo/hula/commit/28043f528b4b80ceacae3636e73aff8a7e8923e0))
* **voice:** :bug: fix voice error ([bc60d9c](https://gitee.com/llangkebo/hula/commit/bc60d9c091fd67eb8ca5fbfa1316354cb053d832))
* **windows:** :bug: fix windows tray flicker abnormal problem ([bea61c5](https://gitee.com/llangkebo/hula/commit/bea61c55d30b3c137eaf1ca3be4b2b3e146091ec))
* **XSS:** :bug: fix some possible bugs in XSS ([946dce4](https://gitee.com/llangkebo/hula/commit/946dce4bf8ef16cbf242f4a89588a076c7da7df4))


### ⚡️ Performance Improvements | 性能优化

* **avatar:** :zap: remove avatar replacement check ([b9225aa](https://gitee.com/llangkebo/hula/commit/b9225aa98bc53729f502e4b4b8a438c4baf77e1c))
* **build:** :zap: optimize the handling of packaged scripts ([a50cc5f](https://gitee.com/llangkebo/hula/commit/a50cc5f31c00b52828209d747832e60fd62337e2))
* **chat:** :zap: optimize chat layout jitter problem ([3b4e55d](https://gitee.com/llangkebo/hula/commit/3b4e55def931678cf6dc0ef5afec75ad23079568))
* **chat:** :zap: optimize chat list scrolling, loading, switching, etc ([80dc1af](https://gitee.com/llangkebo/hula/commit/80dc1afc7544723a5beb1e9a56e0cc9ebfea8516))
* **code:** :zap: remove unnecessary fields ([5ad8b2f](https://gitee.com/llangkebo/hula/commit/5ad8b2f569ab5fa5c4a7f7bc07dfe81bf6959154))
* **common:** :zap: load all data after login ([2d6388f](https://gitee.com/llangkebo/hula/commit/2d6388fd65bb7eef256791578f16603b1dcc40bd))
* **config:** :zap: optimize how map keys are read ([a676b3b](https://gitee.com/llangkebo/hula/commit/a676b3b70b1ca5cd9d675267fd529a1645ed6837))
* **DPR:** :zap: optimize some problems caused by scaling factors ([49ff049](https://gitee.com/llangkebo/hula/commit/49ff04956f5a6af3a7fe4fd532d069bac931e0dd))
* **file manager:** :zap: optimize file management functions and logic for multi-file sending ([9629cff](https://gitee.com/llangkebo/hula/commit/9629cff8762ef155b64c54bdb6706cb26e36c586))
* **file manager:** :zap: optimize style and functionality for file management ([e87f5d8](https://gitee.com/llangkebo/hula/commit/e87f5d815d5363a9e0a7e32065d2b9fbaaa8392a))
* **history:** :zap: optimize historical message management ([aa0f6b0](https://gitee.com/llangkebo/hula/commit/aa0f6b0894e4ade7303495b5d23526bb723982a1))
* **layout:** :zap: optimal layout jitter problem ([499de18](https://gitee.com/llangkebo/hula/commit/499de180d799dd03394e89eedb6343e0323d6a25))
* **list:** :zap: optimize message list display ([d462675](https://gitee.com/llangkebo/hula/commit/d462675fa489b72332d537d15cedcf8892005c9e))
* **messages:** :zap: optimize the content and style of forwarded messages ([d1f9669](https://gitee.com/llangkebo/hula/commit/d1f9669650495a8dd41683efdb78aabe37d2174c))
* **mobile:** :zap: perfect mobile launch page and some other issues ([#352](https://gitee.com/llangkebo/hula/issues/352)) ([86f8736](https://gitee.com/llangkebo/hula/commit/86f873633c11b8ab55418b4538fa23818772313a))
* **mobile:** ⚡ optimize mobile startup page ([c5905d7](https://gitee.com/llangkebo/hula/commit/c5905d7c7b06de3ee9bbbeff3807ef02080a1aac))
* **model:** :zap: optimize 3D model preview functionality ([78ed8fb](https://gitee.com/llangkebo/hula/commit/78ed8fbcac415ae488ec54e059e2a8a9011974e1))
* **multiple:** :zap: optimize multi-choice logic and announcement display logic ([a0d30f7](https://gitee.com/llangkebo/hula/commit/a0d30f7b14e5fe4bb317100229975a7b292b55d6))
* **right click:** :zap: optimize right-click menu display ([0141554](https://gitee.com/llangkebo/hula/commit/0141554fd5f9ef627ab27cf3f186a305f0fe3caf))
* **rtc:** :zap: optimize rtc logic and style ([884ff8b](https://gitee.com/llangkebo/hula/commit/884ff8bb1757a295af76ab710c63aad91d16f5be))
* **shortcut:** :zap: optimize keyboard mapping compatibility ([f48ff0f](https://gitee.com/llangkebo/hula/commit/f48ff0f7f10209ccd13ad6d79ae0e1eb5c1a985f))
* **system:** :zap: optimize chat history, forwarding, merging content and more ([1e66623](https://gitee.com/llangkebo/hula/commit/1e66623a87dc32b0193a02e03e4f14ae570c09f9))
* **views:** :zap: optimize page layout and toggle loading states ([fa99ac2](https://gitee.com/llangkebo/hula/commit/fa99ac25ac4bc2526fad0949b3c6391d94a5f5fc))
* **views:** :zap: optimize reply function and chat page, request list style、 ([56f4096](https://gitee.com/llangkebo/hula/commit/56f4096e6d67eb4d976c883bbc5b14921cfca495))
* **virtual list:** :zap: remove virtual list, use native list ([3625828](https://gitee.com/llangkebo/hula/commit/362582865347994efd0d68f1b32254c2dcbd5145))
* **virtual:** :zap: optimize virtual lists ([8c98b95](https://gitee.com/llangkebo/hula/commit/8c98b95bd29a69f2c8cad82b08679014bc541a22))

## [2.6.13](https://gitee.com/llangkebo/hula/compare/v2.6.12...v2.6.13) (2025-07-04)


### ✨ Features | 新功能

* **component:** :sparkles: 增加文件类型(除语音、视频)等文件类型的样式兼容 ([99711a7](https://gitee.com/llangkebo/hula/commit/99711a73f3296eaefe1281251f76303465cd72d5))
* **component:** :sparkles:增加上传视频、文件、音频等功能 ([#292](https://gitee.com/llangkebo/hula/issues/292)) ([203af0d](https://gitee.com/llangkebo/hula/commit/203af0d06030a6b19c5a2a4705098073f0e9000d))
* **view:** :sparkles: 保持窗口位置和大小 ([#287](https://gitee.com/llangkebo/hula/issues/287)) ([dfc29fa](https://gitee.com/llangkebo/hula/commit/dfc29fa3ed19313f4bc8539a0c788d8c6df3eaab))


### 🐛 Bug Fixes | Bug 修复

* **common:** :bug: 修复未提示用户错误弹框问题 ([916ab6c](https://gitee.com/llangkebo/hula/commit/916ab6c56aeab81b99a14fd2fc6200ffd2226a6a))
* **component:** :bug: 修复mac启动依赖问题 ([81d3bc9](https://gitee.com/llangkebo/hula/commit/81d3bc9f018ea9ba29baae5867e36cc3d2b35eea))
* **component:** :bug: 用户修改当前群聊昵称显示问题 ([e4c43ae](https://gitee.com/llangkebo/hula/commit/e4c43aee74d534f2f9d3ee45a97aeb2d3ecfffa6))
* **hook:** :bug: 修复pinia初始化报错问题 ([c9cdcc0](https://gitee.com/llangkebo/hula/commit/c9cdcc0cc585d260b416c680bc5ccd20dee74526))
* macos开发模式样式不生效 ([#299](https://gitee.com/llangkebo/hula/issues/299)) ([0a1f4ec](https://gitee.com/llangkebo/hula/commit/0a1f4ecd180ad55fdc5be58c1e6798065f37f48e))
* **service:** :bug: 修复网络设置后缀为空时，调用接口失败的bug ([cb1fb70](https://gitee.com/llangkebo/hula/commit/cb1fb701818f1411da76f0dea3b3e8aef1d049de))
* **view:** :bug: 修复文件类型气泡的样式和上传分片功能 ([57ac5c9](https://gitee.com/llangkebo/hula/commit/57ac5c98b7be12113367b54406d72f794a1a96e4))
* **view:** :bug: 只保持主窗口窗口大小 ([8164e91](https://gitee.com/llangkebo/hula/commit/8164e916704dce7f197387f623688a865fe67011))


### ⚡️ Performance Improvements | 性能优化

* **component:** :zap: 优化webSocket的重连性能和网络检测方法 ([54f32ee](https://gitee.com/llangkebo/hula/commit/54f32eec5f4260501c75fa23459ecbcc82e17cb4))
* **service:** :zap: 优化webSocket重连机制 ([18ffde1](https://gitee.com/llangkebo/hula/commit/18ffde1d49bd661ffc283d68e959b669c4bbb54d))
* **store:** :zap: 优化刷新会话列表后，时间和最新消息简介没有更新的问题 ([d2ab29b](https://gitee.com/llangkebo/hula/commit/d2ab29bfd585218447641368a55069286e5e2714))

## [2.6.12](https://gitee.com/llangkebo/hula/compare/v2.6.11...v2.6.12) (2025-05-25)


### ✨ Features | 新功能

* **component:** :sparkles: 增加右键emoji可以另存为 ([0dfdfc1](https://gitee.com/llangkebo/hula/commit/0dfdfc1269256baa59316b7936db94468b733b69))
* **hook:** :sparkles: 增强文本选择复制 ([791b9cc](https://gitee.com/llangkebo/hula/commit/791b9cc69485d9c8245396d72cca834ac9a61aa0)), closes [#279](https://gitee.com/llangkebo/hula/issues/279)


### 🐛 Bug Fixes | Bug 修复

* 修复ws链接断开没有重试问题 ([#276](https://gitee.com/llangkebo/hula/issues/276)) ([e068a25](https://gitee.com/llangkebo/hula/commit/e068a253e5215aacb606f852087e5e9e67010404))
* **agreement:** :bug: 安装界面乱码 ([#277](https://gitee.com/llangkebo/hula/issues/277)) ([13c528a](https://gitee.com/llangkebo/hula/commit/13c528a35e11ee5fa7325beb1fcef8d28f2550e3)), closes [#275](https://gitee.com/llangkebo/hula/issues/275)
* **hook:** :bug: 修复除emoji类型和图片类型都可以另存为的bug ([d2b6ab2](https://gitee.com/llangkebo/hula/commit/d2b6ab25d6fd7ea5a4e9df1d287fe3d3cc9a1b58))
* **hook:** :bug: 修复mac系统右键会选中文本的问题 ([7e762e8](https://gitee.com/llangkebo/hula/commit/7e762e8524df0d17f85ca71eedb95d01dea7c8d3))
* **hook:** :bug: 暂时移除/唤起ai快捷键识别 ([4a1a05c](https://gitee.com/llangkebo/hula/commit/4a1a05cf51b4bab670b2da5faac43bf33f902998))
* **input:** :bug: 修复mac下输入框检查拼写和字母大小写问题 ([f8602e5](https://gitee.com/llangkebo/hula/commit/f8602e56ebbf4ae90f5f5dc7e7cebee317bf4ab4))
* **mac:** :bug: 修复mac下点击关闭按钮无法关闭home窗口问题 ([2a63046](https://gitee.com/llangkebo/hula/commit/2a63046bbd2d7c4cd484d456c708ab47bdc8e792))
* **view:** :bug: 修复托盘菜单内容不展示问题和托盘图标闪烁后不展示问题 ([c927be4](https://gitee.com/llangkebo/hula/commit/c927be4c3fd00cdde9f93c15793ea56ce5b11d14))
* **view:** :bug: 修改邮箱输入框长度限制 ([61618db](https://gitee.com/llangkebo/hula/commit/61618db93cbe9512eceb66fbc50006a90f7d44f1)), closes [#278](https://gitee.com/llangkebo/hula/issues/278)
* **worker:** :bug: 修复ws在重连后清空token导致无法对应获取消息问题 ([030fed7](https://gitee.com/llangkebo/hula/commit/030fed7d60a6eb03dccb49e6f108b2b5d67161e4))


### ⚡️ Performance Improvements | 性能优化

* **global:** :zap: 增加ws健康检查兜底刷新最新消息内容、网络断线恢复重连 ([f734dca](https://gitee.com/llangkebo/hula/commit/f734dca910b17e3dd8a4d8e5e58cae3e7caaa333))

## [2.6.11](https://gitee.com/llangkebo/hula/compare/v2.6.10...v2.6.11) (2025-05-18)


### ⚠ BREAKING CHANGES

* **component:** webSocket的计时器调整为worker计时器

### ✨ Features | 新功能

* **view:** :sparkles: 新增重置密码功能 ([b45cfd2](https://gitee.com/llangkebo/hula/commit/b45cfd22120c9fe46fead1fcb9daf5cc7b25f423))
* **view:** :sparkles: 增加修订版本更新检测，修复每次版本变动都更新的bug ([#271](https://gitee.com/llangkebo/hula/issues/271)) ([833d09e](https://gitee.com/llangkebo/hula/commit/833d09efe4e218d483c37a87cb1bdd39443f46c7))


### 🐛 Bug Fixes | Bug 修复

* **component:** :bug: 点击头像弹出个人信息面板 ([#273](https://gitee.com/llangkebo/hula/issues/273)) ([eaa4288](https://gitee.com/llangkebo/hula/commit/eaa42885c33a03d84cc2999c6a77a1eb4d5baf0a))
* **component:** :bug: 修复回复消息表情不展示问题 ([f33f41d](https://gitee.com/llangkebo/hula/commit/f33f41d41f0f60fb5ab9e0cff6305b0cef548eea))
* **component:** :bug: 修复图片截图功能文件大小问题 ([f816314](https://gitee.com/llangkebo/hula/commit/f816314115a02e10241f299536db9e54854a510f))
* **component:** :bug: 修复因公告宽度导致聊天框布局混乱问题 ([2753e89](https://gitee.com/llangkebo/hula/commit/2753e89dd52f7a4a66eca3ffe5e8189bdc266170))
* **component:** :bug: 修复mac下更新提示窗口可以调整大小、拖动、标题栏显示问题 ([c761486](https://gitee.com/llangkebo/hula/commit/c76148687cd86b2f56d34525bc3d56b859d74a13))
* **component:** :bug: 优化windows上群聊的展示时机和样式 ([92dba12](https://gitee.com/llangkebo/hula/commit/92dba1218ffc113e9ea492c1ead20732c40bce32))
* **ios:** :bug: 修复ios init导致无法启动问题 ([3ef1666](https://gitee.com/llangkebo/hula/commit/3ef1666ef7eadae9990fbeed357b5c1ccc085c12))
* **notify:** :bug: 修复免打扰时还会触发托盘图标闪烁(windows) ([02ef835](https://gitee.com/llangkebo/hula/commit/02ef83585549851836b11dc1e58e7f47e5a06754))
* **view:** :bug: 修复系统托盘闪烁和提示菜单内容不显示问题 ([4954b1c](https://gitee.com/llangkebo/hula/commit/4954b1cc241ed0275619d7c3b7db2b7ead7e680e))
* **view:** :bug: 修复系统托盘信息提示菜单内容展示问题和点击跳转问题 ([2c8b15c](https://gitee.com/llangkebo/hula/commit/2c8b15cd3a971de02c50c682b2f3b8902ba52479))
* **view:** :bug: 修复win下忘记密码页面背景颜色问题 ([bd825e0](https://gitee.com/llangkebo/hula/commit/bd825e0c32534be3cce4788de8b53d9c686c7464))


### ⚡️ Performance Improvements | 性能优化

* **component:** :zap: 优化群聊成员和公告展示、以及完成搜索会话功能 ([a8bf8e0](https://gitee.com/llangkebo/hula/commit/a8bf8e00aba0ea0df35cc165ae0fc71aa333e511))
* **component:** :zap: 优化消息回复表情功能 ([2081e99](https://gitee.com/llangkebo/hula/commit/2081e99d4ad45b8f13ebf57ae7f6b5cceb6f1dbc))
* **component:** :zap: 优化emoji的样式和展示 ([f0aa001](https://gitee.com/llangkebo/hula/commit/f0aa0014a9d6a5ff32a537f4900a61ce340db6de))
* **service:** :zap: 优化websocket可以在窗口隐藏后继续监听 ([884a53e](https://gitee.com/llangkebo/hula/commit/884a53e4484a1a0d0efbcb17f5761ddd80409461))
* **view:** :zap: 优化在登录框下未提示更新、右下角窗口可拖动问题 ([777951b](https://gitee.com/llangkebo/hula/commit/777951bb8cff2383611a81e9aaaa4fc2c2e7f6a6))

## [2.6.10](https://gitee.com/llangkebo/hula/compare/v2.6.9...v2.6.10) (2025-05-05)


### ✨ Features | 新功能

* **component:** :sparkles: 增加公告类型消息 ([f0b0656](https://gitee.com/llangkebo/hula/commit/f0b0656ddc874a597a49de2e4f8666913730e759))
* **view:** :sparkles: 新增发布群公告功能 ([#259](https://gitee.com/llangkebo/hula/issues/259)) ([87fc30d](https://gitee.com/llangkebo/hula/commit/87fc30d170996022379b45d9b94110edbe1c5c74))


### 🐛 Bug Fixes | Bug 修复

* **chat:** 隔离聊天窗口内部数据 ([#258](https://gitee.com/llangkebo/hula/issues/258)) ([635f729](https://gitee.com/llangkebo/hula/commit/635f72996b8e03e1c00bc20fe9ad870ae8d303f4))
* **component:** :bug: 修复表情包圆角样式 ([e5e1725](https://gitee.com/llangkebo/hula/commit/e5e1725d42b41c2bc518e5f4c91cbdbb5f2a3421))
* **component:** :bug: 修复公告排序问题、公告加载更多重复数据问题 ([8d21d22](https://gitee.com/llangkebo/hula/commit/8d21d2228a6f743faa1aa4bf635d9fe8d41efd1f))
* **component:** :bug: 修复链接卡片无法点击后默认浏览器打开的问题 ([296a944](https://gitee.com/llangkebo/hula/commit/296a944c9f0312548e668ae1a6b831d821b502d2))
* **component:** :bug: 修复全选意外选中全部内容的问题 ([6616a93](https://gitee.com/llangkebo/hula/commit/6616a932c57a7189d1540575332471d03684f49b))
* **component:** :bug: 修改群聊中群消息设置逻辑 ([62460fb](https://gitee.com/llangkebo/hula/commit/62460fbfe04802764d5a4d60430d587ecbee528d))
* **component:** :bug: 修改url文本解析样式 ([0d5455c](https://gitee.com/llangkebo/hula/commit/0d5455c9c590406878c572b667dbf8d21ae7a5b1))
* **readme:** :bug: 修改readme中的描述 ([91feb14](https://gitee.com/llangkebo/hula/commit/91feb14ff4fa77c6bb11aeddd90863cd197fec78))


### ⚡️ Performance Improvements | 性能优化

* **component:** :zap: 优化消息点赞和不满功能 ([4d17127](https://gitee.com/llangkebo/hula/commit/4d171273e9ba4f6e584206720eeae636d72626e6))

## [2.6.9](https://gitee.com/llangkebo/hula/compare/v2.6.8...v2.6.9) (2025-04-20)


### ✨ Features | 新功能

* 回复可以回复表情包、图片 ([#251](https://gitee.com/llangkebo/hula/issues/251)) ([4180906](https://gitee.com/llangkebo/hula/commit/418090604a08a189ae94d487f762406a3bc853ab))
* **hooks:** 优化消息类型判断逻辑 ([#249](https://gitee.com/llangkebo/hula/issues/249)) ([82c3fd5](https://gitee.com/llangkebo/hula/commit/82c3fd529c96153a198f1425d02751173761de0b))
* **view:** :sparkles: 新增中版本强制更新功能 ([#252](https://gitee.com/llangkebo/hula/issues/252)) ([edbd3de](https://gitee.com/llangkebo/hula/commit/edbd3defccdfe0d1b6163e82193316f3044217db)), closes [#183](https://gitee.com/llangkebo/hula/issues/183) [#183](https://gitee.com/llangkebo/hula/issues/183) [#183](https://gitee.com/llangkebo/hula/issues/183)
* **view:** :sparkles: 新增子窗口创建方式和邀请加群功能 ([b2a15ca](https://gitee.com/llangkebo/hula/commit/b2a15ca5e219b32115702d06f937a396ddaf57c5))
* **worker:** :sparkles: 代理实现 ([#232](https://gitee.com/llangkebo/hula/issues/232)) ([d4bf21d](https://gitee.com/llangkebo/hula/commit/d4bf21d464cc1faea22abcb5369daef6360cd1e0)), closes [#197](https://gitee.com/llangkebo/hula/issues/197)


### 🐛 Bug Fixes | Bug 修复

* 修复回复框错位 BUG ([#256](https://gitee.com/llangkebo/hula/issues/256)) ([e46ee95](https://gitee.com/llangkebo/hula/commit/e46ee95bb872812101fb0938a6ffdf161a28308f)), closes [#253](https://gitee.com/llangkebo/hula/issues/253)
* **common:** :bug: 修复回复表情包或者emoji的时候位置偏移 ([f9a2b18](https://gitee.com/llangkebo/hula/commit/f9a2b184735a718ea1063f0914837d0bef36367c))
* **common:** :bug: 修复FloatBlockList组件悬浮层bug ([2b9a7ed](https://gitee.com/llangkebo/hula/commit/2b9a7edaef876aeea2a9c4605e136c413675a4f2))
* **config:** :bug: 修复renovate配置问题 ([6b02f3f](https://gitee.com/llangkebo/hula/commit/6b02f3fc61f73bf65e594e9aa23aa610996be429))
* **hook:** :bug: 修复回复时出现空格符和回复替换等问题 ([b8c3c4e](https://gitee.com/llangkebo/hula/commit/b8c3c4eec26212a584f3e368c7b4782b2c5e8f07))
* **hook:** :bug: 修改mac下子窗口创建逻辑 ([7f8795c](https://gitee.com/llangkebo/hula/commit/7f8795c36a158359aaf82e491c927ddf5c80c8ee))
* **hooks:** :bug: 修复一些xss的问题 ([bcce4a0](https://gitee.com/llangkebo/hula/commit/bcce4a01d4a0955d82dcbb82ec570435fa69a343))
* **layout:** :bug: 回退增加系统通知功能 ([c7fbdd7](https://gitee.com/llangkebo/hula/commit/c7fbdd7a0290355a186732f2419ceddc20741e01))
* **message:** 将消息内容解析为文本而不当做 HTML 处理 [#237](https://gitee.com/llangkebo/hula/issues/237) ([#246](https://gitee.com/llangkebo/hula/issues/246)) ([3441b8a](https://gitee.com/llangkebo/hula/commit/3441b8a28286c9e69f27338a6974ebd26eeb69bf))
* **Plugins:** :bug: 修复插件卸载后，重新打开插件列表，状态依旧是安装状态问题 ([#247](https://gitee.com/llangkebo/hula/issues/247)) ([3cee949](https://gitee.com/llangkebo/hula/commit/3cee9498d79a0f2b00fd5ecbac87f3d260d4b449))
* **Plugins:** :bug: 修复插件卸载后，重新打开插件列表，状态依旧是安装状态问题（list布局） ([#248](https://gitee.com/llangkebo/hula/issues/248)) ([9e4f31e](https://gitee.com/llangkebo/hula/commit/9e4f31ea526230a0ce0e1f8b48302c3dc5792eb8))
* **view:** :bug: 修复会话中转义字符的问题 ([b793f71](https://gitee.com/llangkebo/hula/commit/b793f71f26507a4e9b6402dd8a3dd3cfac75c5f8))


### ⚡️ Performance Improvements | 性能优化

* **component:** :zap: 优化链接的展示和解析 ([74bf370](https://gitee.com/llangkebo/hula/commit/74bf3702c73b751c0e3165c357064136896d548f))
* **component:** :zap: 优化屏蔽后的逻辑 ([2a5b9de](https://gitee.com/llangkebo/hula/commit/2a5b9de68b64ceacd535074aaf6284060d869918))
* **component:** :zap: 优化群备注和群昵称(beta) ([fab231a](https://gitee.com/llangkebo/hula/commit/fab231a9166acac97d50426109e2e37364a2d794))
* **rust:** :zap: 修改mac系统托盘的右键菜单 ([6dbfa49](https://gitee.com/llangkebo/hula/commit/6dbfa496b4c18581e5915890033c6ebdf65a6976))

## [2.6.8](https://gitee.com/llangkebo/hula/compare/v2.6.7...v2.6.8) (2025-03-26)


### ✨ Features | 新功能

* **component:** :sparkles: 增加兼容七牛云上传功能 ([eca26a9](https://gitee.com/llangkebo/hula/commit/eca26a977d315da23dec8c178b96b7db3b8a804f))
* **component:** :sparkles: 增加邮箱登录、PIN输入框 ([4be6db7](https://gitee.com/llangkebo/hula/commit/4be6db7d31e77efd93cef9c4108ae0a8cc7ef2e0))


### 🐛 Bug Fixes | Bug 修复

* **chat:** 修复回复消息导致光标偏移 [#223](https://gitee.com/llangkebo/hula/issues/223) ([#224](https://gitee.com/llangkebo/hula/issues/224)) ([2cbf727](https://gitee.com/llangkebo/hula/commit/2cbf7273fb107de1bf363958758aa0a61e1206b4))
* **component:** 🐛 使用setShow手动触发Popover显示 ([#230](https://gitee.com/llangkebo/hula/issues/230)) ([28fdc79](https://gitee.com/llangkebo/hula/commit/28fdc79e1891ca0f81cafe44d65c806bf2bda4f8)), closes [#210](https://gitee.com/llangkebo/hula/issues/210) [#210](https://gitee.com/llangkebo/hula/issues/210) [#210](https://gitee.com/llangkebo/hula/issues/210)
* **hooks:** replace focus call with focusOn function in useMsgInput ([#227](https://gitee.com/llangkebo/hula/issues/227)) ([9deefc0](https://gitee.com/llangkebo/hula/commit/9deefc0fa21df42def3aac8012d622e46a270ef4)), closes [#151](https://gitee.com/llangkebo/hula/issues/151)
* Implement placeholder by CSS ([#226](https://gitee.com/llangkebo/hula/issues/226)) ([9e867c6](https://gitee.com/llangkebo/hula/commit/9e867c672c482e3ca38b03033d80cd79df1c457d))

## [2.6.7](https://gitee.com/llangkebo/hula/compare/v2.6.6...v2.6.7) (2025-03-18)


### ✨ Features | 新功能

* **component:** :sparkles: 增加表情包功能 ([f0e9f27](https://gitee.com/llangkebo/hula/commit/f0e9f27c5fbf28759c5f6520ba49af5649714bb1))
* **component:** :sparkles: 增加动画表情处理 ([bc65a3b](https://gitee.com/llangkebo/hula/commit/bc65a3bd5a97255dbaade6fc4f5e63f29647fdcf))
* **component:** :sparkles: 增加会话列表右键菜单功能(免打扰) ([6731c89](https://gitee.com/llangkebo/hula/commit/6731c89c32ed32c38d1913876d3e9df3d168f969))
* **component:** :sparkles: 增加localStorage缓存消息列表(暂时) ([e714431](https://gitee.com/llangkebo/hula/commit/e7144313a4858bd5c918e9d9a4d377b0ce8cadbc))
* **vite:** add vite-plugin-vue-devtools for enhanced debugging ([#219](https://gitee.com/llangkebo/hula/issues/219)) ([a8b548c](https://gitee.com/llangkebo/hula/commit/a8b548cb0bca1eedcd5d16e4589eded8761d2455))


### 🐛 Bug Fixes | Bug 修复

* **chat-editor:** record cursor position correctly ([#221](https://gitee.com/llangkebo/hula/issues/221)) ([6ad6c58](https://gitee.com/llangkebo/hula/commit/6ad6c586912eeeb04a6ea49d9bbf0b5962fdfcc6))
* **component:** :bug: 完善消息免打扰功能和样式 ([0eed677](https://gitee.com/llangkebo/hula/commit/0eed67780521a28cb51a4272498add8f008f784f))
* **component:** :bug: 修复缓存存储问题、会话切换后聊天框内容混合问题 ([51b7d62](https://gitee.com/llangkebo/hula/commit/51b7d621fad80cee15aedf201068103c4e88a23d))
* **component:** :bug: 修复回复的内容宽度问题 ([0dcddfc](https://gitee.com/llangkebo/hula/commit/0dcddfc810b731e194c2a37f16d56473bbf0607a))
* **component:** :bug: 修复新消息回复无法跳转问题 ([65264b3](https://gitee.com/llangkebo/hula/commit/65264b3dacb8820a9938f107408ec31306a0738e))
* **component:** :bug: 修复用户上线推送的数据类型错误问题 ([474a388](https://gitee.com/llangkebo/hula/commit/474a3886f45476e2640a86f3fb8c991fc96399ee))
* **component:** :bug: 修复右键二级菜单图标错误bug ([0b97ccb](https://gitee.com/llangkebo/hula/commit/0b97ccb76785e5f8a13466ad93a8b32beb213572))
* **component:** :bug: 修复win下聊天框滚动条隐藏坍塌问题和会话快速切换的异步竞态问题 ([a39c054](https://gitee.com/llangkebo/hula/commit/a39c054b6264fb2cc0addfb2d1970b880ba53fd4))
* **layout:** :bug: 修复F5刷新会使窗口变大的bug ([#214](https://gitee.com/llangkebo/hula/issues/214)) ([51baa1a](https://gitee.com/llangkebo/hula/commit/51baa1a907a1339d354fbe3f131cdf87a9d9a49a))
* **store:** :bug: 修复群聊列表获取不到问题(后续把stores中定义的reactive换为ref) ([40e9786](https://gitee.com/llangkebo/hula/commit/40e97862153a084542bb263f2d5bd33f3dc39472))
* **util:** :bug: 修复消息上报在未登录的时候触发问题 ([34e6633](https://gitee.com/llangkebo/hula/commit/34e663373b1885fab34724b6ef2091a9bb9a9bc0))
* **view:** :bug: 修复重新启动应用后的登录逻辑 ([1560cb4](https://gitee.com/llangkebo/hula/commit/1560cb4a0bc8729f4b008ba8c96ee6918a8b6dfe))


### ⚡️ Performance Improvements | 性能优化

* **component:** :zap: 优化好友申请列表 ([52f9047](https://gitee.com/llangkebo/hula/commit/52f9047299282c1d5b2f67efbd6f2fc865fc476e))
* **component:** :zap: 优化好友申请列表和群详情 ([15d16e5](https://gitee.com/llangkebo/hula/commit/15d16e567f2082c0ee87939a9816e1c7c84ae362))
* **component:** :zap: 优化好友页面和聊天页面切换需要重新加载问题 ([20f52e4](https://gitee.com/llangkebo/hula/commit/20f52e471bd8684036b1ecfa8ecf6064ea75cc18))
* **component:** :zap: 优化群聊操作(我的群昵称、群备注、群名称) ([dcf4664](https://gitee.com/llangkebo/hula/commit/dcf4664a185b6ab83b324a9e40e191b99c6e09a9))
* **component:** :zap: 优化群聊详情显示 ([6960555](https://gitee.com/llangkebo/hula/commit/696055585c9d734d069b0d9d797aad7b62cd88ee))
* **component:** :zap: 优化头像上传功能（群头像） ([7e865c7](https://gitee.com/llangkebo/hula/commit/7e865c7cb0e6f1c6d4fb87c1a95a8aa2471304fa))
* **component:** :zap: 优化消息列表 ([1bc38ba](https://gitee.com/llangkebo/hula/commit/1bc38ba4c1dea8d0ca830166b9bbbc3e6f41c845))
* **component:** :zap: 优化虚拟列表 ([19d699b](https://gitee.com/llangkebo/hula/commit/19d699b19f7e324ca01c852400add6a98ed3ef5f))
* **component:** :zap: 优化虚拟列表滚动掉帧问题 ([3bea8d9](https://gitee.com/llangkebo/hula/commit/3bea8d9f02ae179528b8673eb3f9cc6894a58381))
* **component:** :zap: 优化虚拟列表加载更多闪屏的问题和消息气泡动画问题 ([530ce3e](https://gitee.com/llangkebo/hula/commit/530ce3e63d74d97a2fbc10ad862a7fe166365bb0))
* **component:** :zap: 优化右键二级菜单弹出的问题 ([90d55bb](https://gitee.com/llangkebo/hula/commit/90d55bb4baefa287fd458ed8f089786a9fb5d372))
* **component:** :zap: 优化右键二级菜单点击事件不触发问题、拆分屏蔽消息和免打扰功能 ([29bec4f](https://gitee.com/llangkebo/hula/commit/29bec4f373d2e8ce1dbcc5a88d02844b70a0b9e1))
* **view:** :zap: 优化群主管理员标签样式 ([64eefbe](https://gitee.com/llangkebo/hula/commit/64eefbe7bdaef03b4598776c64f01ecdbe90626d))
* **view:** :zap: 优化申请群聊功能 ([c492c0d](https://gitee.com/llangkebo/hula/commit/c492c0d18e9b0288ae45827b71bd29f4632bb636))
* **view:** :zap: 优化项目中类型的编写和定义方式 ([a832dc1](https://gitee.com/llangkebo/hula/commit/a832dc1220468de33f724c78256047a84ff62811))



## <small>2.6.6 (2025-03-01)</small>

* fix(global): :bug: 修复一些内容的类型问题 ([2c16343](https://gitee.com/llangkebo/hula/commit/2c16343))
* fix(service): :bug: 修复oss接口配置问题 ([5e2f6e4](https://gitee.com/llangkebo/hula/commit/5e2f6e4))
* perf(component): :zap: 优化一些功能的操作体验和样式 ([31c1709](https://gitee.com/llangkebo/hula/commit/31c1709))
* perf(service): :zap: 优化http模块 ([801ec4e](https://gitee.com/llangkebo/hula/commit/801ec4e))
* feat(component): :sparkles: 增加预加载页面样式 ([90f108a](https://gitee.com/llangkebo/hula/commit/90f108a))

## <small>2.6.5 (2025-02-27)</small>

* fix(common): :bug: 修复登出账号时没有清空系统托盘图标上的未读数(MacOS) ([383a776](https://gitee.com/llangkebo/hula/commit/383a776))
* fix(component): :bug: 修复加好友/群聊顶部栏不可操作问题和窗口通信响应式问题 ([b08e7d8](https://gitee.com/llangkebo/hula/commit/b08e7d8))
* fix(component): :bug: 修复跳转到会话选中回退第一个问题 ([029f3f9](https://gitee.com/llangkebo/hula/commit/029f3f9))
* fix(config): :bug: 修复检查更新问题(暂时先切换回github) ([d6d488b](https://gitee.com/llangkebo/hula/commit/d6d488b))
* fix(file): :bug: 修复git未监听文件名大小写修改 ([9a8659b](https://gitee.com/llangkebo/hula/commit/9a8659b))
* fix(git): :bug: 删除多余的文件，导致打包出错 ([df7fed3](https://gitee.com/llangkebo/hula/commit/df7fed3))
* fix(global): :bug: 修改全局使用到的一些类型为string ([3333aa0](https://gitee.com/llangkebo/hula/commit/3333aa0)), closes [#211](https://gitee.com/llangkebo/hula/issues/211)
* fix(worker): :bug: 修复ws连接问题和一些页面组件问题 ([eadea02](https://gitee.com/llangkebo/hula/commit/eadea02))
* perf(component): :zap: 优化侧边栏功能 ([d1f831d](https://gitee.com/llangkebo/hula/commit/d1f831d))
* perf(component): :zap: 优化加好友/群聊窗体样式和功能 ([6716913](https://gitee.com/llangkebo/hula/commit/6716913))
* perf(component): :zap: 优化自动登录功能 ([5cb9bfc](https://gitee.com/llangkebo/hula/commit/5cb9bfc))
* perf(service): :zap: 优化群聊功能 (#208) ([0e07e33](https://gitee.com/llangkebo/hula/commit/0e07e33)), closes [#208](https://gitee.com/llangkebo/hula/issues/208)
* perf(view): :zap: 优化登录逻辑 ([67cad46](https://gitee.com/llangkebo/hula/commit/67cad46))
* perf(view): :zap: 优化群聊侧边栏用户信息展示 ([4b03f57](https://gitee.com/llangkebo/hula/commit/4b03f57))
* perf(view): :zap: 优化群聊侧边栏状态展示和聊天框顶部栏状态展示 ([e15cf9b](https://gitee.com/llangkebo/hula/commit/e15cf9b))
* perf(view): :zap: 优化图片查看器 ([22f84f1](https://gitee.com/llangkebo/hula/commit/22f84f1))
* feat(component): :sparkles: 新增用户状态切换 ([5098733](https://gitee.com/llangkebo/hula/commit/5098733))
* feat(service): :sparkles: 增加双token校验 ([776b6ec](https://gitee.com/llangkebo/hula/commit/776b6ec)), closes [#IBNT91](https://gitee.com/llangkebo/hula/issues/IBNT91)
* feat(view): :sparkles: 添加好友或群，基本完成了查找添加好友相关的内容，可以查出来群聊信息暂时还没有写添加 (#209) ([90a8985](https://gitee.com/llangkebo/hula/commit/90a8985)), closes [#209](https://gitee.com/llangkebo/hula/issues/209)
* chore: 发布 v2.6.4 ([ac9d922](https://gitee.com/llangkebo/hula/commit/ac9d922))
* [Snyk] Upgrade @tauri-apps/plugin-clipboard-manager from 2.2.0 to 2.2.1 (#206) ([54354c6](https://gitee.com/llangkebo/hula/commit/54354c6)), closes [#206](https://gitee.com/llangkebo/hula/issues/206)
* [Snyk] Upgrade @tauri-apps/plugin-http from 2.2.0 to 2.3.0 (#207) ([cbf5f4d](https://gitee.com/llangkebo/hula/commit/cbf5f4d)), closes [#207](https://gitee.com/llangkebo/hula/issues/207)
* docs(readme): :memo: 更新赞助者名单 ([4d9aabe](https://gitee.com/llangkebo/hula/commit/4d9aabe))


### BREAKING CHANGE

* 一次性查出多条。添加好友用的是AddFriendsModal.vu页面进行一些修改,

closed https://gitee.com/HuLaSpark/HuLa/issues/IBJYSD

* fix(view): :bug: 修改创建窗体minH的问题

## <small>2.6.4 (2025-02-21)</small>

* fix(common): :bug: 修复登出账号时没有清空系统托盘图标上的未读数(MacOS) ([383a776](https://gitee.com/llangkebo/hula/commit/383a776))
* fix(component): :bug: 修复跳转到会话选中回退第一个问题 ([029f3f9](https://gitee.com/llangkebo/hula/commit/029f3f9))
* fix(config): :bug: 修复检查更新问题(暂时先切换回github) ([d6d488b](https://gitee.com/llangkebo/hula/commit/d6d488b))
* fix(file): :bug: 修复git未监听文件名大小写修改 ([9a8659b](https://gitee.com/llangkebo/hula/commit/9a8659b))
* fix(git): :bug: 删除多余的文件，导致打包出错 ([df7fed3](https://gitee.com/llangkebo/hula/commit/df7fed3))
* fix(worker): :bug: 修复ws连接问题和一些页面组件问题 ([eadea02](https://gitee.com/llangkebo/hula/commit/eadea02))
* feat(component): :sparkles: 新增用户状态切换 ([5098733](https://gitee.com/llangkebo/hula/commit/5098733))
* feat(service): :sparkles: 增加双token校验 ([776b6ec](https://gitee.com/llangkebo/hula/commit/776b6ec)), closes [#IBNT91](https://gitee.com/llangkebo/hula/issues/IBNT91)
* [Snyk] Upgrade @tauri-apps/plugin-clipboard-manager from 2.2.0 to 2.2.1 (#206) ([54354c6](https://gitee.com/llangkebo/hula/commit/54354c6)), closes [#206](https://gitee.com/llangkebo/hula/issues/206)
* [Snyk] Upgrade @tauri-apps/plugin-http from 2.2.0 to 2.3.0 (#207) ([cbf5f4d](https://gitee.com/llangkebo/hula/commit/cbf5f4d)), closes [#207](https://gitee.com/llangkebo/hula/issues/207)
* perf(view): :zap: 优化群聊侧边栏用户信息展示 ([4b03f57](https://gitee.com/llangkebo/hula/commit/4b03f57))
* perf(view): :zap: 优化群聊侧边栏状态展示和聊天框顶部栏状态展示 ([e15cf9b](https://gitee.com/llangkebo/hula/commit/e15cf9b))
* perf(view): :zap: 优化图片查看器 ([22f84f1](https://gitee.com/llangkebo/hula/commit/22f84f1))
* docs(readme): :memo: 更新赞助者名单 ([4d9aabe](https://gitee.com/llangkebo/hula/commit/4d9aabe))

## <small>2.6.3 (2025-02-15)</small>

* feat(component): :sparkles: 增加更换头像功能 ([63ba2e6](https://gitee.com/llangkebo/hula/commit/63ba2e6))
* feat(directive): :sparkles: 新增图片查看器 ([6a06f32](https://gitee.com/llangkebo/hula/commit/6a06f32))
* feat(preview): :sparkles: 增加本地开发配置以及赞助渠道 ([788da74](https://gitee.com/llangkebo/hula/commit/788da74))
* feat(service): ✨ 可选参数禁用http请求重试 (#202) ([223b9f2](https://gitee.com/llangkebo/hula/commit/223b9f2)), closes [#202](https://gitee.com/llangkebo/hula/issues/202)
* build(deps-dev): bump vitest from 3.0.1 to 3.0.5 (#201) ([2a857e3](https://gitee.com/llangkebo/hula/commit/2a857e3)), closes [#201](https://gitee.com/llangkebo/hula/issues/201)
* build(deps): bump dompurify from 3.2.3 to 3.2.4 (#205) ([835fb88](https://gitee.com/llangkebo/hula/commit/835fb88)), closes [#205](https://gitee.com/llangkebo/hula/issues/205)
* build(mobile): :package: 修改移动端文件的位置和配置 ([12e81fd](https://gitee.com/llangkebo/hula/commit/12e81fd))
* perf(common): :zap: 优化图片查看器和请求重试报错机制 ([25c39b7](https://gitee.com/llangkebo/hula/commit/25c39b7))
* perf(component): :zap: 优化图片查看器 ([3afd91e](https://gitee.com/llangkebo/hula/commit/3afd91e))
* fix(view): :bug: 修复好友申请方不知道对方已同意的bug (#203) ([01fd658](https://gitee.com/llangkebo/hula/commit/01fd658)), closes [#203](https://gitee.com/llangkebo/hula/issues/203)
* Dev retry (#199) ([7abc4b3](https://gitee.com/llangkebo/hula/commit/7abc4b3)), closes [#199](https://gitee.com/llangkebo/hula/issues/199)
* docs: :memo: 更新wx群二维码 ([1ad09e6](https://gitee.com/llangkebo/hula/commit/1ad09e6))

## <small>2.6.2 (2025-01-23)</small>

* feat(strategy): :sparkles: 增加表情包功能支持 ([6b19f07](https://gitee.com/llangkebo/hula/commit/6b19f07))
* feat(strategy): :sparkles: 增加发送图片功能(beta) ([f1aef7c](https://gitee.com/llangkebo/hula/commit/f1aef7c))
* chore(deps): update dependency vite to v6.0.9 [security] (#195) ([5777318](https://gitee.com/llangkebo/hula/commit/5777318)), closes [#195](https://gitee.com/llangkebo/hula/issues/195)
* perf(component): :zap: 优化组件加载、浏览器指纹生成 (#192) ([0252956](https://gitee.com/llangkebo/hula/commit/0252956)), closes [#192](https://gitee.com/llangkebo/hula/issues/192)
* perf(icon): :zap: 修改全平台icon（除了mac） (#193) ([eea52ea](https://gitee.com/llangkebo/hula/commit/eea52ea)), closes [#193](https://gitee.com/llangkebo/hula/issues/193)
* perf(view): :zap: 优化已删除好友的界面展示 ([69d7722](https://gitee.com/llangkebo/hula/commit/69d7722))

## <small>2.6.1 (2025-01-17)</small>

* fix(Android): :bug: 修复安卓启动配置 (#191) ([5176aee](https://gitee.com/llangkebo/hula/commit/5176aee)), closes [#191](https://gitee.com/llangkebo/hula/issues/191)
* fix(build): :bug: 去除alsa-sys的安装 ([b5f8402](https://gitee.com/llangkebo/hula/commit/b5f8402))
* fix(build): :bug: 修复ubuntu alsa-sys包版本 (#145) ([0840d7e](https://gitee.com/llangkebo/hula/commit/0840d7e)), closes [#145](https://gitee.com/llangkebo/hula/issues/145)
* fix(build): :bug: 修复ubuntu CI打包问题 (#144) ([c4f46f8](https://gitee.com/llangkebo/hula/commit/c4f46f8)), closes [#144](https://gitee.com/llangkebo/hula/issues/144)
* fix(common): :bug: 修复系统托盘状态切换问题 (#153) ([00e2a89](https://gitee.com/llangkebo/hula/commit/00e2a89)), closes [#153](https://gitee.com/llangkebo/hula/issues/153)
* fix(common): :bug: 修复set_badge_count方法没有处理报错问题 (#140) ([4d4bd9c](https://gitee.com/llangkebo/hula/commit/4d4bd9c)), closes [#140](https://gitee.com/llangkebo/hula/issues/140)
* fix(component): :bug: 修复tray设置窗口大小问题 (#149) ([7aaabb2](https://gitee.com/llangkebo/hula/commit/7aaabb2)), closes [#149](https://gitee.com/llangkebo/hula/issues/149)
* fix(docker): :bug: 修改docker-compose配置 (#162) ([e1b1984](https://gitee.com/llangkebo/hula/commit/e1b1984)), closes [#162](https://gitee.com/llangkebo/hula/issues/162)
* fix(mobile): :bug: 修复ios移动端页面问题 (#185) ([af7d388](https://gitee.com/llangkebo/hula/commit/af7d388)), closes [#185](https://gitee.com/llangkebo/hula/issues/185)
* fix(renovate): :bug: 修复renovate bot配置 (#164) ([0dd59a5](https://gitee.com/llangkebo/hula/commit/0dd59a5)), closes [#164](https://gitee.com/llangkebo/hula/issues/164)
* fix(service): :bug: 优化浏览器指纹 (#175) ([a2b3c32](https://gitee.com/llangkebo/hula/commit/a2b3c32)), closes [#175](https://gitee.com/llangkebo/hula/issues/175)
* fix(service): :bug: 增加浏览器指纹作为唯一值解决netty关联channel的问题 (#171) ([a5b5f89](https://gitee.com/llangkebo/hula/commit/a5b5f89)), closes [#171](https://gitee.com/llangkebo/hula/issues/171)
* fix(view): :bug: 修复系统托盘无法变化成多列表操作 (#150) ([cb08e62](https://gitee.com/llangkebo/hula/commit/cb08e62)), closes [#150](https://gitee.com/llangkebo/hula/issues/150)
* fix(view): :bug: 修复setSize方法导致无法修改窗口大小问题 ([412db5c](https://gitee.com/llangkebo/hula/commit/412db5c)), closes [#139](https://gitee.com/llangkebo/hula/issues/139)
* perf(mobile): :zap: 优化ios整体页面 (#186) ([2feb359](https://gitee.com/llangkebo/hula/commit/2feb359)), closes [#186](https://gitee.com/llangkebo/hula/issues/186)
* perf(view): :zap: 优化聊天框用户信息操作选项 (#173) ([b024757](https://gitee.com/llangkebo/hula/commit/b024757)), closes [#173](https://gitee.com/llangkebo/hula/issues/173)
* perf(view): :zap: 优化win的托盘闪烁和消息提示 (#142) ([4e49700](https://gitee.com/llangkebo/hula/commit/4e49700)), closes [#142](https://gitee.com/llangkebo/hula/issues/142)
* perf(worker): :zap: 使用worker优化计时器不准确问题 (#190) ([000fcc2](https://gitee.com/llangkebo/hula/commit/000fcc2)), closes [#190](https://gitee.com/llangkebo/hula/issues/190)
* feat(android): :sparkles: 新增android兼容 (#170) ([684b95c](https://gitee.com/llangkebo/hula/commit/684b95c)), closes [#170](https://gitee.com/llangkebo/hula/issues/170)
* feat(mobile): :sparkles: 新增移动端兼容 (#169) ([3607c9d](https://gitee.com/llangkebo/hula/commit/3607c9d)), closes [#169](https://gitee.com/llangkebo/hula/issues/169) [#61](https://gitee.com/llangkebo/hula/issues/61)
* feat(mobile): :sparkles: 增加ios下拉刷新功能 (#189) ([837d2b3](https://gitee.com/llangkebo/hula/commit/837d2b3)), closes [#189](https://gitee.com/llangkebo/hula/issues/189)
* feat(scripts): :sparkles: 新增环境检测脚本(用于检测用户当前系统环境) (#166) ([3983bf7](https://gitee.com/llangkebo/hula/commit/3983bf7)), closes [#166](https://gitee.com/llangkebo/hula/issues/166)
* feat(service): :sparkles: http错误提示 (#184) ([cd03444](https://gitee.com/llangkebo/hula/commit/cd03444)), closes [#184](https://gitee.com/llangkebo/hula/issues/184)
* feat(service): :sparkles: http请求重试 (#178) ([2d0f3e0](https://gitee.com/llangkebo/hula/commit/2d0f3e0)), closes [#178](https://gitee.com/llangkebo/hula/issues/178)
* feat(system): :sparkles: 新增linxu系统ubuntu兼容 (#148) ([373d87c](https://gitee.com/llangkebo/hula/commit/373d87c)), closes [#148](https://gitee.com/llangkebo/hula/issues/148)
* feat(view): :sparkles: 增加透明高斯模糊开关 (#177) ([cefe53d](https://gitee.com/llangkebo/hula/commit/cefe53d)), closes [#177](https://gitee.com/llangkebo/hula/issues/177)
* !45 fix(view): :bug:修复群聊问题 ([b0432d6](https://gitee.com/llangkebo/hula/commit/b0432d6)), closes [#152](https://gitee.com/llangkebo/hula/issues/152)
* Http请求重试并抛出错误 (#181) ([16c4dea](https://gitee.com/llangkebo/hula/commit/16c4dea)), closes [#181](https://gitee.com/llangkebo/hula/issues/181)
* Test actions (#147) ([9755340](https://gitee.com/llangkebo/hula/commit/9755340)), closes [#147](https://gitee.com/llangkebo/hula/issues/147)
* build: 升级依赖 (#161) ([498f490](https://gitee.com/llangkebo/hula/commit/498f490)), closes [#161](https://gitee.com/llangkebo/hula/issues/161) [#156](https://gitee.com/llangkebo/hula/issues/156) [#155](https://gitee.com/llangkebo/hula/issues/155) [#157](https://gitee.com/llangkebo/hula/issues/157) [#158](https://gitee.com/llangkebo/hula/issues/158) [#159](https://gitee.com/llangkebo/hula/issues/159)
* chore: 发布 v2.6.0 ([f411af6](https://gitee.com/llangkebo/hula/commit/f411af6))
* ci: :ferris_wheel: 优化CI配置 (#141) ([6b47049](https://gitee.com/llangkebo/hula/commit/6b47049)), closes [#141](https://gitee.com/llangkebo/hula/issues/141)

## 2.6.0 (2025-01-05)

* feat(system): :sparkles: 新增linxu系统ubuntu兼容 (#148) ([43d1561](https://gitee.com/llangkebo/hula/commit/43d1561)), closes [#148](https://gitee.com/llangkebo/hula/issues/148)
* Test actions (#147) ([d0a0e5f](https://gitee.com/llangkebo/hula/commit/d0a0e5f)), closes [#147](https://gitee.com/llangkebo/hula/issues/147)
* fix(build): :bug: 去除alsa-sys的安装 ([64f0c39](https://gitee.com/llangkebo/hula/commit/64f0c39))
* fix(build): :bug: 修复ubuntu alsa-sys包版本 (#145) ([d6adb2d](https://gitee.com/llangkebo/hula/commit/d6adb2d)), closes [#145](https://gitee.com/llangkebo/hula/issues/145)
* fix(build): :bug: 修复ubuntu CI打包问题 (#144) ([5d66161](https://gitee.com/llangkebo/hula/commit/5d66161)), closes [#144](https://gitee.com/llangkebo/hula/issues/144)
* fix(common): :bug: 修复set_badge_count方法没有处理报错问题 (#140) ([4d4bd9c](https://gitee.com/llangkebo/hula/commit/4d4bd9c)), closes [#140](https://gitee.com/llangkebo/hula/issues/140)
* fix(view): :bug: 修复setSize方法导致无法修改窗口大小问题 (#143) ([b412c2e](https://gitee.com/llangkebo/hula/commit/b412c2e)), closes [#143](https://gitee.com/llangkebo/hula/issues/143) [#139](https://gitee.com/llangkebo/hula/issues/139)
* perf(view): :zap: 优化win的托盘闪烁和消息提示 (#142) ([4e49700](https://gitee.com/llangkebo/hula/commit/4e49700)), closes [#142](https://gitee.com/llangkebo/hula/issues/142)
* ci: :ferris_wheel: 优化CI配置 (#141) ([6b47049](https://gitee.com/llangkebo/hula/commit/6b47049)), closes [#141](https://gitee.com/llangkebo/hula/issues/141)

## [2.5.11](https://gitee.com/llangkebo/hula/compare/v2.5.10...v2.5.11) (2025-01-03)


### ✨ Features | 新功能

* **component:** :sparkles: 新增AI选项卡，封装提及框功能 ([#133](https://gitee.com/llangkebo/hula/issues/133)) ([9fdb695](https://gitee.com/llangkebo/hula/commit/9fdb6953ab2c9d46c75b715aac40d211cb605fa7))
* **notification:** :sparkles: 新增notification系统通知 ([#127](https://gitee.com/llangkebo/hula/issues/127)) ([77373e3](https://gitee.com/llangkebo/hula/commit/77373e3782f8f5679940605656259efbb21db558))
* **service:** :sparkles: 新增翻译服务api ([#130](https://gitee.com/llangkebo/hula/issues/130)) ([fadbf2b](https://gitee.com/llangkebo/hula/commit/fadbf2b24a7f5688d02de47ac36254902018e56e))


### 🐛 Bug Fixes | Bug 修复

* **common:** :bug: 修复一些流程和已知的问题 ([#134](https://gitee.com/llangkebo/hula/issues/134)) ([ca0dc1f](https://gitee.com/llangkebo/hula/commit/ca0dc1fc778c3c2b9b4175b11ea02fc3cace1cd5))
* **common:** :bug: 修复一些已知问题 ([#137](https://gitee.com/llangkebo/hula/issues/137)) ([16cd17a](https://gitee.com/llangkebo/hula/commit/16cd17aa54fe32399fdeb6a11470fac6daede754))
* **event:** :bug: 修复tauri listen未销毁问题 ([#124](https://gitee.com/llangkebo/hula/issues/124)) ([7b762e2](https://gitee.com/llangkebo/hula/commit/7b762e26a086ca69b0c71093f9382fc865b259aa))
* **pnpm:** :bug: 更新版本依赖 ([#138](https://gitee.com/llangkebo/hula/issues/138)) ([15a645e](https://gitee.com/llangkebo/hula/commit/15a645ec78214886e2502226bc7fa176ba91d912))
* **version:** :bug: 修复升级tauri版本导致的高度问题 ([#125](https://gitee.com/llangkebo/hula/issues/125)) ([adf47e7](https://gitee.com/llangkebo/hula/commit/adf47e7acc38c7159ddc0aaa4bb38784ff5f1594))


### ⚡️ Performance Improvements | 性能优化

* **component:** :zap: 可在设置中切换翻译提供商 ([#132](https://gitee.com/llangkebo/hula/issues/132)) ([99a8859](https://gitee.com/llangkebo/hula/commit/99a8859476bef5593641076a6fdadd2b48153be2))
* **component:** :zap: 优化撤回消息重新编辑判定 ([#128](https://gitee.com/llangkebo/hula/issues/128)) ([451ded8](https://gitee.com/llangkebo/hula/commit/451ded82c58cdfd4d8941533db50df61f448b292))
* **component:** :zap: 优化翻译的显示 ([#131](https://gitee.com/llangkebo/hula/issues/131)) ([c18ee4b](https://gitee.com/llangkebo/hula/commit/c18ee4b46715b072cfa7ff82b790c68c63a5eb62))
* **component:** :zap: 优化虚拟列表加载更多功能 ([#129](https://gitee.com/llangkebo/hula/issues/129)) ([a1641e9](https://gitee.com/llangkebo/hula/commit/a1641e96ccde507a28f56c8083a8e37bd379da6c))

## [2.5.10](https://gitee.com/llangkebo/hula/compare/v2.5.9...v2.5.10) (2024-12-25)


### 🐛 Bug Fixes | Bug 修复

* **common:** :bug: 修复提示的效果问题 ([#121](https://gitee.com/llangkebo/hula/issues/121)) ([0b7c873](https://gitee.com/llangkebo/hula/commit/0b7c873556be3d14752293d762f87a4d417843dd)), closes [#34](https://gitee.com/llangkebo/hula/issues/34)
* **component:** :bug: 修复输入框和虚拟列表的一些问题 ([#117](https://gitee.com/llangkebo/hula/issues/117)) ([7f4040f](https://gitee.com/llangkebo/hula/commit/7f4040fd4e5597227cbd3a2c0e3beb84f7e288bd))
* **component:** :bug: 修复整体流程bug问题 ([#118](https://gitee.com/llangkebo/hula/issues/118)) ([11fdfe6](https://gitee.com/llangkebo/hula/commit/11fdfe65a0fe46b4792cf579a47bbb9b75f465de))
* **rust:** :bug: 修复windows启动报错问题 ([#119](https://gitee.com/llangkebo/hula/issues/119)) ([311bd72](https://gitee.com/llangkebo/hula/commit/311bd72b6af9627221d4c12bf5d1089380d5b4f5)), closes [#IBD413](https://gitee.com/llangkebo/hula/issues/IBD413)
* **rust:** :bug: 修复windows下启动问题 ([#122](https://gitee.com/llangkebo/hula/issues/122)) ([9f43c9e](https://gitee.com/llangkebo/hula/commit/9f43c9e77d647cfdc30aa04ad51ac6b0ce608a49))
* **windows:** :bug: 修复windows下打包出错问题 ([#123](https://gitee.com/llangkebo/hula/issues/123)) ([e346da3](https://gitee.com/llangkebo/hula/commit/e346da33cf26143bc5d98f1bee61933ceebfff58))


### ⚡️ Performance Improvements | 性能优化

* **component:** :zap: 优化使用for-of ([#120](https://gitee.com/llangkebo/hula/issues/120)) ([003171b](https://gitee.com/llangkebo/hula/commit/003171bc1eb688e0a37f94735ca1e4d71446cf94))
* **component:** :zap: 优化虚拟列表的滚动和性能 ([#112](https://gitee.com/llangkebo/hula/issues/112)) ([e8b60ee](https://gitee.com/llangkebo/hula/commit/e8b60ee83bb9f7f4048899df31113b83f0f01c62))

## [2.5.9](https://gitee.com/llangkebo/hula/compare/v2.5.8...v2.5.9) (2024-12-18)


### ✨ Features | 新功能

* **component:** :sparkles: 新增默认头像 ([#104](https://gitee.com/llangkebo/hula/issues/104)) ([5a4ff70](https://gitee.com/llangkebo/hula/commit/5a4ff7065b2f5c2339f8f6208bf3fe3d73c59400))


### 🐛 Bug Fixes | Bug 修复

* **CI:** :bug: 修复release配置 ([#110](https://gitee.com/llangkebo/hula/issues/110)) ([6969a09](https://gitee.com/llangkebo/hula/commit/6969a0999ec0a0114e21e9db8ea8f56a82c73e09))
* **component:** :bug: 修复mac下输入框输入拼音时的问题 ([#108](https://gitee.com/llangkebo/hula/issues/108)) ([6fd6636](https://gitee.com/llangkebo/hula/commit/6fd6636cef63c05cdd2ed04858d533ad98e0c34f))
* **component:** :bug: 修复naiveui的虚拟列表问题 ([#109](https://gitee.com/llangkebo/hula/issues/109)) ([1ec6020](https://gitee.com/llangkebo/hula/commit/1ec602016869119e51348c40436aeda120a0dccd))
* **config:** :bug: 修改renovate bot的配置 ([23511f7](https://gitee.com/llangkebo/hula/commit/23511f78cd5b22449bbc53cb5c567255250ca863))
* **view:** :bug: 修复群里在线人数问题和登录历史记录问题 ([#105](https://gitee.com/llangkebo/hula/issues/105)) ([4dae48e](https://gitee.com/llangkebo/hula/commit/4dae48e1ad380bc5ca68b664fe89664ac68235fd))
* **view:** :bug: 修复异常关闭再重新登录会不显示会话的bug ([096df49](https://gitee.com/llangkebo/hula/commit/096df49dcd9408eecadb9344d5d7433468e7bc5c))


### ⚡️ Performance Improvements | 性能优化

* **hook:** :zap: 优化windows窗口圆角问题 ([024c1a3](https://gitee.com/llangkebo/hula/commit/024c1a36d8ab435151d6485921b198070b15076e))
* **view:** :zap: 优化一下样式和登录页面的提示 ([#107](https://gitee.com/llangkebo/hula/issues/107)) ([8bb4aa7](https://gitee.com/llangkebo/hula/commit/8bb4aa77d93fb731d3ff85fe273d20e7b4ba991d)), closes [#106](https://gitee.com/llangkebo/hula/issues/106)

## [2.5.8](https://gitee.com/llangkebo/hula/compare/v2.5.7...v2.5.8) (2024-12-12)


### ✨ Features | 新功能

* **component:** :sparkles: 新增米游社表情包功能 ([1b38500](https://gitee.com/llangkebo/hula/commit/1b385005be135d8afc83ec1d5fb80d1ab25bf5f5))


### 🐛 Bug Fixes | Bug 修复

* **chat-edittor:** 在 Webkit  中 re-focus 后焦点被重置 ([e381a09](https://gitee.com/llangkebo/hula/commit/e381a09fb138be627b01df6f096a0ad9383eef99))
* **common:** :bug: 修改Cargo.lock ([e3ead1c](https://gitee.com/llangkebo/hula/commit/e3ead1c7fdf30b7a2eb857973dfcc66bb01dc44b))
* **component:** :bug: 修复canvas模糊问题，以及图片和emoji的一些插入的位置和优化 ([5dee0ae](https://gitee.com/llangkebo/hula/commit/5dee0ae4d4d09178a1664d5f2ec01354a69b8001))
* **config:** :bug: 修改cargo的镜像源和文件后缀 ([d882e2e](https://gitee.com/llangkebo/hula/commit/d882e2e301b8ae27819dd8469452d40a704ea4a6))
* **package:** :bug: 修复发版和commit的命令 ([6307326](https://gitee.com/llangkebo/hula/commit/6307326b016bfc654b0e6f70bc254d59d0fcde67))

## [2.5.7](https://gitee.com/llangkebo/hula/compare/v2.5.6...v2.5.7) (2024-12-10)


### 🐛 Bug Fixes | Bug 修复

* **config:** :bug: 修复因为notify窗口没有配置问题导致mac下打不开 ([d940838](https://gitee.com/llangkebo/hula/commit/d940838f380c8e626926dae1dceea6a4076ea83f)), closes [#55](https://gitee.com/llangkebo/hula/issues/55)

## [2.5.6](https://gitee.com/llangkebo/hula/compare/v2.5.5...v2.5.6) (2024-12-09)


### ✨ Features | 新功能

* **component:** :sparkles: 新增创建群聊弹窗 ([10fb45f](https://gitee.com/llangkebo/hula/commit/10fb45f8d9cc48058ad54c8c24ce50ab434a45a8))
* **hook:** :sparkles: 添加消息保存到本地数据库功能 ([8b67a1b](https://gitee.com/llangkebo/hula/commit/8b67a1b0b67822d70459b26beaf85b4fb9e2cab2))
* **hooks:** :sparkles: 新增 useMitter 钩子以替代直接使用 Mitt 事件总线 ([44db95d](https://gitee.com/llangkebo/hula/commit/44db95d3fecdad11155e9583f85d5b51d1407173))
* **plugin:** :sparkles: 限制只能一台设备打开一个客户端 ([ab9a515](https://gitee.com/llangkebo/hula/commit/ab9a5153fecb6da048540247bbae63080399540b))
* **view:** :sparkles: 新增新消息状态栏图标闪烁 ([09264b7](https://gitee.com/llangkebo/hula/commit/09264b7918c11044fe2830a8c5607cceb162d106))


### 🐛 Bug Fixes | Bug 修复

* **component:** :bug: 修复聊天框右键菜单问题和添加好友等一些已知问题 ([69b4cbd](https://gitee.com/llangkebo/hula/commit/69b4cbd63f7bb8cd286d4c673babf08bd1fb2008))
* **layout:** :bug: 处理退出账号bug|处理登录token有时未保存bug|其他优化 ([470efde](https://gitee.com/llangkebo/hula/commit/470efded2edff37a93e0a002a34ca7aec6c90172))
* **layout:** :bug: 处理异常关闭程序发送下线通知 ([2cf5e97](https://gitee.com/llangkebo/hula/commit/2cf5e97d1e05c1641c7919b2f4e521dd176860cd))
* **layout:** :bug: 处理mitt合并冲突 ([f0766e1](https://gitee.com/llangkebo/hula/commit/f0766e1907a9411683de94b54072638d30d06478))
* **layout:** :bug: 修复登录不同账号会导致其他账号退出登录的问题 ([2b21f83](https://gitee.com/llangkebo/hula/commit/2b21f83bab32ed19504b9dad9aa32f33c73cec5b))
* **layout:** :bug: 修复自动登录bug|修复登录token未保存bug|其他优化 ([945502f](https://gitee.com/llangkebo/hula/commit/945502fa38fd8a7fb7d15bd1a7e8f018dddeac67))
* **service:** :bug: 处理pinia报错 ([c9d65dc](https://gitee.com/llangkebo/hula/commit/c9d65dc82a4777edf5f636a7b26bd976364d8d64))
* **service:** :bug: 修复异常退出登录bug，优化ws ([c671db8](https://gitee.com/llangkebo/hula/commit/c671db8d98dbce6fcdf248232a4a2eca020d770f))
* **store:** :bug: 修复store中保存的用户信息冲突导致登录的用户信息错乱问题 ([6119e42](https://gitee.com/llangkebo/hula/commit/6119e420b0b355cb6dde7f3f4d0d6e07f7202358))
* **view:** :bug: 固定右下角消息提示位置 ([5bc78d2](https://gitee.com/llangkebo/hula/commit/5bc78d2c8b4aa6e1f69d2f6d9e01db6b23ee7e9d))
* **view:** :bug: 修复右下角消息提示位置不对bug ([db19672](https://gitee.com/llangkebo/hula/commit/db19672295ac8b1abc0489cf76b41dbf9d6b3ebe))
* **view:** :bug: 修复自动登录bug ([8b1da81](https://gitee.com/llangkebo/hula/commit/8b1da812e1845190a708ea146cb075ef907dd12d))


### ⚡️ Performance Improvements | 性能优化

* **component:** :zap: 优化撤回信息后的功能 ([7cbb443](https://gitee.com/llangkebo/hula/commit/7cbb443e84f04e6b19f45a0fa779639d75a4939e))
* **component:** :zap: 优化消息气泡发送状态提示 ([90b7c91](https://gitee.com/llangkebo/hula/commit/90b7c91264e88052d3cc1086b81900cf08d0e213))
* **component:** :zap: 优化新增群组功能 ([e33de24](https://gitee.com/llangkebo/hula/commit/e33de24dec294bccb68e10821f05b09d09c1f358))
* **component:** :zap: 优化一些代码和逻辑 ([4b500a1](https://gitee.com/llangkebo/hula/commit/4b500a1c9ef60dda95f513755ea362a865194e55))
* **component:** :zap: 优化右键@和发送消息功能 ([91e8703](https://gitee.com/llangkebo/hula/commit/91e8703af0c66a61eddec245fe1132d26194a303))
* **component:** :zap: 优化注册流程和样式 ([3d59a7d](https://gitee.com/llangkebo/hula/commit/3d59a7d6d0e0558f04e96dc536e1e8cfb0955520))
* **hook:** :zap: 优化useMitt的写法 ([004a696](https://gitee.com/llangkebo/hula/commit/004a6960100f2139ef7e3021db0da6081c60954a))
* **view:** :zap: 优化代理功能 ([0cf8dc9](https://gitee.com/llangkebo/hula/commit/0cf8dc9bb9fafa66a419497bcf814f8fcc1cb791))
* **view:** :zap: 优化useMitt的取消时机 ([f7f6bc0](https://gitee.com/llangkebo/hula/commit/f7f6bc0ada6a6531586c74b08995056cb92d30ba))

## [2.5.5](https://gitee.com/llangkebo/hula/compare/v2.5.4...v2.5.5) (2024-11-20)


### 🐛 Bug Fixes | Bug 修复

* **service:** :bug: 修复更新功能版本出错问题以及修复输入框和聊天框对于特殊字符和兼容性 ([9c1d23d](https://gitee.com/llangkebo/hula/commit/9c1d23d2060dbad13d4197517feec6d3a410e742))
* **style:** :bug: 修复聊天消息框回复宽度限制问题 ([d0aca70](https://gitee.com/llangkebo/hula/commit/d0aca707a7a549aa0696a1074da62e58d7449056))

## [2.5.4](https://gitee.com/llangkebo/hula/compare/v2.5.3...v2.5.4) (2024-11-19)

### 🐛 Bug Fixes | Bug 修复

- **component:** :bug: 修复群聊侧边栏搜索时无法右键查看用户信息 ([f5b5bb0](https://gitee.com/llangkebo/hula/commit/f5b5bb09c8711227e4ccb9e3bc4e65bdc52415b9))
- **component:** :bug: 修复群聊当前登录用户右键菜单功能逻辑错误 ([00c35ff](https://gitee.com/llangkebo/hula/commit/00c35ff6feda18623c608b8aa29529c30a48e528))
- **hook:** :bug: 修复发送消息频繁的bug ([bbb74ee](https://gitee.com/llangkebo/hula/commit/bbb74ee78a425375a44ce6940dbed0b8265b618c))
- **service:** :bug: 修复http模块没有设置请求头导致请求报错问题 ([1538964](https://gitee.com/llangkebo/hula/commit/153896480e8a86cd50962d3678fae786ea444ebd))
- **store:** :bug: 上下线通知 ([2f2a2a2](https://gitee.com/llangkebo/hula/commit/2f2a2a2068143e723db3ec31cfce3f2397acf8d4))
- **store:** :bug: 修复一些接口的store封装 ([4626527](https://gitee.com/llangkebo/hula/commit/46265275e52fd30090a3d07a98f1023e9960b18d))
- **view:** :bug: 修复一些功能漏洞问题 ([#38](https://gitee.com/llangkebo/hula/issues/38)) ([f626a96](https://gitee.com/llangkebo/hula/commit/f626a96c1abfb00e07d53fceec12ea3cdd1faca0))
- **view:** :bug: 修复打开独立窗口后主窗口消息窗口无法打开问题 ([#36](https://gitee.com/llangkebo/hula/issues/36)) ([06435c8](https://gitee.com/llangkebo/hula/commit/06435c8d58250d4b9501431dc82c51643bc6e054))
- **view:** :bug: 修复登录和请求的一些缺陷 ([54ee3ff](https://gitee.com/llangkebo/hula/commit/54ee3ff1688ec1dd248b5e7120e3613ce8758ac9))

## [2.5.3](https://gitee.com/llangkebo/hula/compare/v2.5.2...v2.5.3) (2024-11-06)

### 🐛 Bug Fixes | Bug 修复

- **component:** :bug: 修复输入框换行不兼容webkit的问题 ([345d830](https://gitee.com/llangkebo/hula/commit/345d83068711df087dd0ba403446c739151a11dd))
- **layout:** :bug: 修复聊天框改变宽度的时候可以选中文本的问题 ([56d79cc](https://gitee.com/llangkebo/hula/commit/56d79ccc8ba015a313eabcd938757f35d1d840a4))
- **layout:** :bug: 修复选择了图片不显示在输入框中的bug ([c7cdac6](https://gitee.com/llangkebo/hula/commit/c7cdac69ce6fa185489dcb480991e3a268fec99d))
- **service:** :bug: 修复请求接口bug ([f3723d4](https://gitee.com/llangkebo/hula/commit/f3723d4e5a2342314ce6e85931a49f1ddfecab0b))

### ⚡️ Performance Improvements | 性能优化

- **component:** :zap: 优化右键菜单功能 ([7b53029](https://gitee.com/llangkebo/hula/commit/7b530297ac37122ead00a15864e16a73a5547d04))

## [2.5.2](https://gitee.com/llangkebo/hula/compare/v2.5.1...v2.5.2) (2024-10-31)

### 🐛 Bug Fixes | Bug 修复

- **build:** :bug: 升级wry版本修复mac安装报错问题 ([fefa2f9](https://gitee.com/llangkebo/hula/commit/fefa2f970305839064764cd1d82a0d8e557f3148))
- **component:** :bug: 修复聊天框内右键菜单问题 ([e59630b](https://gitee.com/llangkebo/hula/commit/e59630b70ed0d245174c97136d502bb63cac03ec))

## [2.5.1](https://gitee.com/llangkebo/hula/compare/v2.5.0...v2.5.1) (2024-10-29)

### 🐛 Bug Fixes | Bug 修复

- **build:** :bug: 修复release配置导致打包的问题 ([4cd9a93](https://gitee.com/llangkebo/hula/commit/4cd9a9355d3c5cbd9101b709a839017c92538bfd))
- **build:** :bug: 添加不同编译版本，以修复不同架构安装出错问题 ([19fb138](https://gitee.com/llangkebo/hula/commit/19fb138d51afd2884c1abd7fc62ae47762c2678b))
- **global:** :bug: 修复艾特弹窗在mac下高度问题导致不显示 ([8a18e84](https://gitee.com/llangkebo/hula/commit/8a18e84ce781a7a987575ed9f27d2a8eff334bb6))
- **layout:** :bug: 修复更新弹窗显示更新的内容 ([bd7f6fb](https://gitee.com/llangkebo/hula/commit/bd7f6fbe7f27e69275e54c776d761a1751289bf0))
- **view:** :bug: 修复消息输入框部分bug ([24b8a51](https://gitee.com/llangkebo/hula/commit/24b8a517d85f5895ae66db64ac7d6d8ae547cad4))

## [2.5.0](https://gitee.com/llangkebo/hula/compare/v2.4.0...v2.5.0) (2024-10-27)

### ⚠ BREAKING CHANGES

- **util:** http请求异常bug

### ✨ Features | 新功能

- **layout:** :sparkles: 自动更新增加进度条 ([4ee3e2b](https://gitee.com/llangkebo/hula/commit/4ee3e2b8a36b34cdc996a8b538bddea61bbf1af2))

### 🐛 Bug Fixes | Bug 修复

- **api:** 修改websocket请求地址, 修改请求方式采用fetch处理 ([e55f863](https://gitee.com/llangkebo/hula/commit/e55f86385fb8e25e826ae57341e0d818f5fe34b2))
- **build:** :bug: 修复因为类型导致打包出错 ([db26e6b](https://gitee.com/llangkebo/hula/commit/db26e6bdf65003c1263574464a194236aa341129))
- **layout:** :bug: 修复更新进度条显示异常bug ([45e2bfc](https://gitee.com/llangkebo/hula/commit/45e2bfce669c76cbb72be641febf59509b3e6204))
- **service:** :bug: 修复打包后访问不了正式服务器的bug ([c8d42ab](https://gitee.com/llangkebo/hula/commit/c8d42ab31e1e6b41b3a30f1664d1be0c28d4ed36))
- **service:** :bug: 修复请求体包裹多层data的问题 ([d97d24f](https://gitee.com/llangkebo/hula/commit/d97d24f1c1d554e5477b221c725e45100655c0e0))
- **util:** :bug: http请求异常bug ([6e82a09](https://gitee.com/llangkebo/hula/commit/6e82a099a2a51ea08548c4d5da496393a94b7b05))
- **view:** :bug: 修复点击右侧布局页面时候不跳转回消息页 ([be0edf9](https://gitee.com/llangkebo/hula/commit/be0edf974778b58fe5af9ec030d9927999a6d7bb))

## [2.4.0](https://gitee.com/llangkebo/hula/compare/v2.3.0...v2.4.0) (2024-10-24)

### ✨ Features | 新功能

- **ide:** :sparkles: 新增.idea文件提供idea的项目图标 ([84b6039](https://gitee.com/llangkebo/hula/commit/84b6039a81370d9d71c8394e6dbb4145b1fb7f1e))
- **layout:** :sparkles: 菜单优化|插件优化|新增菜单显示模式切换 ([78f09c5](https://gitee.com/llangkebo/hula/commit/78f09c5bb9449f5546823f71265c247c137a9e55))
- **setting:** :sparkles: 新增开机启动功能 ([91ad538](https://gitee.com/llangkebo/hula/commit/91ad538f72909e16f232310a58a5b7610dfd08f0))

### 🐛 Bug Fixes | Bug 修复

- **layout:** :bug: 代码修复 ([96ad89c](https://gitee.com/llangkebo/hula/commit/96ad89c05d2b9d104b4a80f064892d63381441a2))
- **layout:** :bug: 修复侧边栏顶部空白块颜色和无法缩小主页面问题 ([1999f30](https://gitee.com/llangkebo/hula/commit/1999f30b0e363d63bf1f1a8c0fda7bdc80c9b8b7))
- **layout:** :bug: 修复窗体高度整体变大bug ([396a103](https://gitee.com/llangkebo/hula/commit/396a103a24255568f426b1c08e4d7e7beb60264b))
- **layout:** :bug: 插件菜单增加图标和点击事件 ([bcbb61a](https://gitee.com/llangkebo/hula/commit/bcbb61a652a121e2cf251d6b4dfefa1c7bf00dec))
- **view:** :bug: 修复一些页面拖动区域问题 ([1183b7e](https://gitee.com/llangkebo/hula/commit/1183b7e3baabcbb9cfabe23327583221ae083ae8)), closes [#25](https://gitee.com/llangkebo/hula/issues/25)
- **view:** :bug: 修复侧边栏图标和字体宽度不一致问题 ([901218b](https://gitee.com/llangkebo/hula/commit/901218b043aa87ef4f5c972eb01aeb37ee4c56a5))
