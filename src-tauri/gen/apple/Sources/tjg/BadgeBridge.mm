#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <dispatch/dispatch.h>

static inline NSInteger TjgSanitizeBadge(NSInteger count) {
    if (count < 0) {
        return 0;
    }
    if (count > 99) {
        return 99;
    }
    return count;
}

static void TjgSetBadgeInternal(NSInteger count) {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIApplication *app = UIApplication.sharedApplication;
        if (!app) {
            return;
        }
        app.applicationIconBadgeNumber = TjgSanitizeBadge(count);
    });
}

#ifdef __cplusplus
extern "C" {
#endif

void tjg_set_application_badge(int32_t count) {
    TjgSetBadgeInternal(count);
}

void tjg_request_badge_authorization(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (@available(iOS 10.0, *)) {
            UNUserNotificationCenter *center = [UNUserNotificationCenter currentNotificationCenter];
            UNAuthorizationOptions options = UNAuthorizationOptionBadge;
            [center requestAuthorizationWithOptions:options
                                  completionHandler:^(BOOL granted, NSError *_Nullable error) {
                                      if (error) {
                                          NSLog(@"[TjgBadge] badge authorization error: %@", error);
                                      }
                                      if (!granted) {
                                          NSLog(@"[TjgBadge] badge authorization denied by user");
                                      }
                                  }];
        } else {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
            UIUserNotificationType types = UIUserNotificationTypeBadge;
            UIUserNotificationSettings *settings = [UIUserNotificationSettings settingsForTypes:types categories:nil];
            [UIApplication.sharedApplication registerUserNotificationSettings:settings];
#pragma clang diagnostic pop
        }
        [UIApplication.sharedApplication registerForRemoteNotifications];
    });
}

#ifdef __cplusplus
}
#endif
