#import <UIKit/UIKit.h>
#import <dispatch/dispatch.h>

static UIView *tjgSplashView = nil;

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

static void TjgEnsureSplashView(void) {
  UIWindow *window = TjgFindActiveWindow();
  if (window == nil) {
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(16 * NSEC_PER_MSEC)),
                   dispatch_get_main_queue(), ^{
                     TjgEnsureSplashView();
                   });
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
  imageView.backgroundColor = UIColor.whiteColor;
  imageView.image = image;
  imageView.accessibilityIdentifier = @"tjg.native.splash";

  tjgSplashView = imageView;
  [window addSubview:tjgSplashView];
}

static void TjgShowSplashView(void) {
  TjgEnsureSplashView();
  if (tjgSplashView == nil) {
    return;
  }
  tjgSplashView.alpha = 1.0;
  tjgSplashView.hidden = NO;
}

static void TjgHideSplashView(void) {
  if (tjgSplashView == nil) {
    return;
  }
  [UIView animateWithDuration:0.35
                        delay:0
                      options:UIViewAnimationOptionCurveEaseInOut
                   animations:^{
                     tjgSplashView.alpha = 0.0;
                   }
                   completion:^(BOOL finished) {
                     (void)finished;
                     [tjgSplashView removeFromSuperview];
                     tjgSplashView = nil;
                   }];
}

#ifdef __cplusplus
extern "C" {
#endif

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

#ifdef __cplusplus
}
#endif
