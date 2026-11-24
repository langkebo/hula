#import <UIKit/UIKit.h>
#import <objc/runtime.h>
#import <dispatch/dispatch.h>

#import "TjgBridge.h"

// 是否连「键盘上方的 Done / 上下箭头栏」一起去掉。
//
// 默认 1：产品决策为彻底去掉该栏（A1）。做法是对 WebKit 私有类做「类级方法替换」
// （而不是改写实例 isa）：
//   好处：不破坏 KVO、不误伤 WKScrollView、对启动后新建的 WebView 同样生效；
//   代价：依赖私有类名 WKContentView / WKScrollContentView，存在审核指南 2.5.1 的风险，
//         该风险已评估并接受；类名取不到时静默跳过，不会崩溃。
//
// 注意：仅靠本栏还不够，公开 API 路径（清空 inputAssistantItem）仍然保留，
// 用于覆盖 iPad 的快捷键栏。
#ifndef TJG_REMOVE_INPUT_ACCESSORY_VIEW
#define TJG_REMOVE_INPUT_ACCESSORY_VIEW 1
#endif

#pragma mark - 窗口枚举

static NSArray<UIWindow *> *TjgVisibleWindows(void) {
    NSMutableArray<UIWindow *> *result = [NSMutableArray array];

    if (@available(iOS 13.0, *)) {
        for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
            if (scene.activationState != UISceneActivationStateForegroundActive &&
                scene.activationState != UISceneActivationStateForegroundInactive) {
                continue;
            }
            if (![scene isKindOfClass:[UIWindowScene class]]) {
                continue;
            }
            for (UIWindow *window in ((UIWindowScene *)scene).windows) {
                if (!window.isHidden) {
                    [result addObject:window];
                }
            }
        }
    } else {
        for (UIWindow *window in UIApplication.sharedApplication.windows) {
            if (!window.isHidden) {
                [result addObject:window];
            }
        }
    }

    return result;
}

#pragma mark - 公开 API 路径

/// 清空某个 responder 的快捷键栏按钮组。
/// 幂等：内容已为空时不重复赋值，避免多余的 KVO 通知。
static void TjgClearAssistantItem(UIResponder *responder) {
    if (![responder respondsToSelector:@selector(inputAssistantItem)]) {
        return;
    }

    UITextInputAssistantItem *item = responder.inputAssistantItem;
    if (item == nil) {
        return;
    }

    if (item.leadingBarButtonGroups.count > 0) {
        item.leadingBarButtonGroups = @[];
    }
    if (item.trailingBarButtonGroups.count > 0) {
        item.trailingBarButtonGroups = @[];
    }
}

/// 深度优先找到第一响应者并清空其快捷键栏；命中即返回，不再遍历其余分支。
static BOOL TjgClearAssistantItemForFirstResponder(UIView *view) {
    if (view == nil) {
        return NO;
    }

    if (view.isFirstResponder) {
        TjgClearAssistantItem(view);
        return YES;
    }

    for (UIView *subview in view.subviews) {
        if (TjgClearAssistantItemForFirstResponder(subview)) {
            return YES;
        }
    }

    return NO;
}

static void TjgClearAssistantItemInAllWindows(void) {
    for (UIWindow *window in TjgVisibleWindows()) {
        TjgClearAssistantItemForFirstResponder(window);
    }
}

#pragma mark - 可选：类级方法替换（默认关闭）

#if TJG_REMOVE_INPUT_ACCESSORY_VIEW

static UIView *TjgNoInputAccessoryViewIMP(id self, SEL _cmd) {
    (void)self;
    (void)_cmd;
    return nil;
}

static void TjgInstallInputAccessoryViewOverride(void) {
    // 这些类名是 WebKit 私有实现细节，可能随系统版本变化；取不到就静默跳过。
    NSArray<NSString *> *candidateClassNames = @[@"WKContentView", @"WKScrollContentView"];

    for (NSString *className in candidateClassNames) {
        Class cls = NSClassFromString(className);
        if (cls == Nil) {
            continue;
        }

        SEL selector = @selector(inputAccessoryView);
        Method method = class_getInstanceMethod(cls, selector);
        if (method == NULL) {
            continue;
        }

        // class_replaceMethod：类里已有则替换，继承自父类则新增覆写。
        class_replaceMethod(cls,
                            selector,
                            (IMP)TjgNoInputAccessoryViewIMP,
                            method_getTypeEncoding(method));
        NSLog(@"[TjgKeyboard] inputAccessoryView override installed on %@", className);
    }
}

#endif

#pragma mark - 通知订阅

static void TjgHandleKeyboardNotification(void) {
#if TJG_REMOVE_INPUT_ACCESSORY_VIEW
    // WebKit 可能晚于启动才加载，键盘弹出时必然已加载，这里再补装一次（幂等）。
    TjgInstallInputAccessoryViewOverride();
#endif

    TjgClearAssistantItemInAllWindows();

    // 少数情况下 WKContentView 在 WillShow 之后才成为 first responder，
    // 下一个 runloop 再补一次。
    dispatch_async(dispatch_get_main_queue(), ^{
        TjgClearAssistantItemInAllWindows();
    });
}

static void TjgInstallOnce(void) {
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        NSNotificationCenter *center = [NSNotificationCenter defaultCenter];
        NSOperationQueue *mainQueue = [NSOperationQueue mainQueue];

        NSArray<NSNotificationName> *names = @[
            UIKeyboardWillShowNotification,
            UIKeyboardWillChangeFrameNotification,
        ];

        for (NSNotificationName name in names) {
            [center addObserverForName:name
                                object:nil
                                 queue:mainQueue
                            usingBlock:^(NSNotification * _Nonnull note) {
                                (void)note;
                                TjgHandleKeyboardNotification();
                            }];
        }

#if TJG_REMOVE_INPUT_ACCESSORY_VIEW
        TjgInstallInputAccessoryViewOverride();
#endif
    });
}

#pragma mark - 对外入口

void tjg_disable_keyboard_accessory(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        TjgInstallOnce();
        // 键盘可能已经处于弹出状态（热启动），立即处理一次。
        TjgClearAssistantItemInAllWindows();
    });
}
