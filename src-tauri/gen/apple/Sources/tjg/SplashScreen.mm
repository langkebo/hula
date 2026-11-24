#import <UIKit/UIKit.h>
#import <dispatch/dispatch.h>

#import "TjgBridge.h"

// 窗口就绪前的最多轮询次数 / 间隔。60 × 0.05s = 3s，
// 足够覆盖冷启动与热启动，又不会在后台无限自旋。
static const int TjgSplashMaxAttempts = 60;
static const NSTimeInterval TjgSplashRetryInterval = 0.05;
static const NSTimeInterval TjgSplashFadeOutDuration = 0.35;

static UIView *tjgSplashView = nil;

// 每次 show / hide 都自增；淡出动画的 completion 只在 token 未被超越时才真正移除视图。
static NSUInteger tjgSplashGeneration = 0;

// 调用方最后一次表达的意图（YES = 应可见）。窗口迟迟未就绪时用于丢弃过期的 show。
static BOOL tjgSplashWanted = NO;

// 防止多次 show 叠出多条重试链。仅主线程读写。
static BOOL tjgSplashEnsureInFlight = NO;

static UIWindow *TjgFindActiveWindow(void) {
    UIWindow *targetWindow = nil;

    if (@available(iOS 13.0, *)) {
        NSSet<UIScene *> *connectedScenes = UIApplication.sharedApplication.connectedScenes;
        for (UIScene *scene in connectedScenes) {
            if (scene.activationState != UISceneActivationStateForegroundActive &&
                scene.activationState != UISceneActivationStateForegroundInactive) {
                continue;
            }
            if (![scene isKindOfClass:[UIWindowScene class]]) {
                continue;
            }
            UIWindowScene *windowScene = (UIWindowScene *)scene;
            for (UIWindow *window in windowScene.windows) {
                if (window.isHidden) {
                    continue;
                }
                if (window.isKeyWindow) {
                    return window;
                }
                if (targetWindow == nil) {
                    targetWindow = window;
                }
            }
        }
    }

    return targetWindow;
}

static void TjgEnsureSplashViewAttempt(int attempt) {
    UIWindow *window = TjgFindActiveWindow();

    if (window == nil) {
        if (attempt >= TjgSplashMaxAttempts) {
            tjgSplashEnsureInFlight = NO;
            NSLog(@"[TjgSplash] 找不到可用 window（尝试 %d 次后放弃）", attempt);
            return;
        }
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW,
                                     (int64_t)(TjgSplashRetryInterval * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{
            TjgEnsureSplashViewAttempt(attempt + 1);
        });
        return;
    }

    tjgSplashEnsureInFlight = NO;

    // 等待期间调用方已经 hide 过了，不要再把蒙层贴上去。
    if (!tjgSplashWanted) {
        return;
    }

    if (tjgSplashView != nil) {
        if (tjgSplashView.superview != window) {
            [tjgSplashView removeFromSuperview];
            tjgSplashView.frame = window.bounds;
            [window addSubview:tjgSplashView];
        }
        return;
    }

    UIImage *image = [UIImage imageNamed:@"LaunchImage"];
    if (image == nil) {
        image = [UIImage imageNamed:@"Mobile/2"];
    }

    UIImageView *imageView = [[UIImageView alloc] initWithFrame:window.bounds];
    imageView.autoresizingMask = UIViewAutoresizingFlexibleWidth | UIViewAutoresizingFlexibleHeight;
    imageView.contentMode = UIViewContentModeScaleAspectFill;
    // 不要写死白色：深色模式下会先闪一下白底。
    imageView.backgroundColor = UIColor.clearColor;
    imageView.image = image;
    imageView.accessibilityIdentifier = @"tjg.native.splash";

    tjgSplashView = imageView;
    [window addSubview:tjgSplashView];
}

static void TjgEnsureSplashView(void) {
    if (tjgSplashEnsureInFlight) {
        return;
    }
    tjgSplashEnsureInFlight = YES;
    TjgEnsureSplashViewAttempt(0);
}

static void TjgShowSplashView(void) {
    tjgSplashWanted = YES;
    TjgEnsureSplashView();

    if (tjgSplashView == nil) {
        return;
    }

    // 让进行中的淡出失效。
    tjgSplashGeneration += 1;
    [tjgSplashView.layer removeAllAnimations];
    tjgSplashView.alpha = 1.0;
    tjgSplashView.hidden = NO;
}

static void TjgHideSplashView(void) {
    tjgSplashWanted = NO;

    UIView *view = tjgSplashView;
    if (view == nil) {
        return;
    }

    const NSUInteger token = ++tjgSplashGeneration;
    [view.layer removeAllAnimations];

    [UIView animateWithDuration:TjgSplashFadeOutDuration
                          delay:0
                        options:UIViewAnimationOptionCurveEaseInOut |
                                UIViewAnimationOptionBeginFromCurrentState
                     animations:^{
                         view.alpha = 0.0;
                     }
                     completion:^(BOOL finished) {
                         (void)finished;
                         // 动画期间被 show 抢占（或被新的 hide 取代）-> 不能移除。
                         if (token != tjgSplashGeneration) {
                             return;
                         }
                         if (tjgSplashView != view) {
                             return;
                         }
                         [view removeFromSuperview];
                         tjgSplashView = nil;
                     }];
}

void tjg_show_splashscreen(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        TjgShowSplashView();
    });
}

void tjg_hide_splashscreen(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        TjgHideSplashView();
    });
}
