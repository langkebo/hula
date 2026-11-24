#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <dispatch/dispatch.h>
#import <os/lock.h>
#import <stdint.h>

#import "TjgBridge.h"

static inline NSInteger TjgSanitizeBadge(int32_t count) {
    if (count < 0) {
        return 0;
    }
    if (count > 99) {
        return 99;
    }
    return (NSInteger)count;
}

#pragma mark - 合并高频写入

static os_unfair_lock tjgBadgeLock = OS_UNFAIR_LOCK_INIT;
static int32_t tjgBadgePendingValue = 0;
static BOOL tjgBadgeFlushScheduled = NO;

static void TjgApplyBadge(NSInteger count) {
    if (@available(iOS 16.0, *)) {
        UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
        [center setBadgeCount:count
            withCompletionHandler:^(NSError * _Nullable error) {
                if (error) {
                    // 常见原因：用户未授予通知权限、或未调用 tjg_request_badge_authorization。
                    NSLog(@"[TjgBadge] setBadgeCount(%ld) failed: %@", (long)count, error);
                }
            }];
        return;
    }

#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wdeprecated-declarations"
    UIApplication.sharedApplication.applicationIconBadgeNumber = count;
#pragma clang diagnostic pop
}

static void TjgScheduleBadgeFlush(void) {
    os_unfair_lock_lock(&tjgBadgeLock);
    BOOL needsSchedule = !tjgBadgeFlushScheduled;
    tjgBadgeFlushScheduled = YES;
    os_unfair_lock_unlock(&tjgBadgeLock);

    if (!needsSchedule) {
        return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
        os_unfair_lock_lock(&tjgBadgeLock);
        int32_t latest = tjgBadgePendingValue;
        tjgBadgeFlushScheduled = NO;
        os_unfair_lock_unlock(&tjgBadgeLock);

        TjgApplyBadge(TjgSanitizeBadge(latest));
    });
}

#pragma mark - 对外入口

void tjg_set_application_badge(int32_t count) {
    os_unfair_lock_lock(&tjgBadgeLock);
    tjgBadgePendingValue = count;
    os_unfair_lock_unlock(&tjgBadgeLock);

    TjgScheduleBadgeFlush();
}

void tjg_request_badge_authorization(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (@available(iOS 10.0, *)) {
            UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
            [center requestAuthorizationWithOptions:UNAuthorizationOptionBadge
                                  completionHandler:^(BOOL granted, NSError * _Nullable error) {
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
            UIUserNotificationSettings *settings =
                [UIUserNotificationSettings settingsForTypes:types categories:nil];
            [UIApplication.sharedApplication registerUserNotificationSettings:settings];
#pragma clang diagnostic pop
        }
    });
}

void tjg_register_for_remote_notifications(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        UIApplication *app = UIApplication.sharedApplication;
        if (app == nil) {
            return;
        }
        [app registerForRemoteNotifications];
    });
}
