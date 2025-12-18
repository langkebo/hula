package com.luohuo.flex.im.push;

import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * FCM推送提供者
 *
 * @author HuLa
 */
@Slf4j
@Component
public class FcmPushProvider implements PushProvider {

    private final PushConfig.FcmConfig config;

    public FcmPushProvider(PushConfig config) {
        this.config = config.getFcm();
    }

    @Override
    public PushType getType() {
        return PushType.FCM;
    }

    @Override
    public boolean push(String deviceToken, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("FCM push is disabled");
            return false;
        }

        try {
            // 构建通知消息
            Map<String, Object> notification = new HashMap<>();
            notification.put("title", title);
            notification.put("body", content);
            notification.put("sound", "default");

            // 构建数据消息
            Map<String, Object> data = new HashMap<>();
            if (extra != null) {
                data.putAll(extra);
            }

            // 构建完整的消息
            Map<String, Object> message = new HashMap<>();
            message.put("token", deviceToken);
            message.put("notification", notification);
            message.put("data", data);
            message.put("android", Map.of(
                    "priority", "high",
                    "notification", Map.of(
                            "channel_id", "default_channel",
                            "click_action", "FLUTTER_NOTIFICATION_CLICK"
                    )
            ));

            // TODO: 实际FCM推送逻辑
            // 使用Firebase Admin SDK进行推送
            log.info("FCM push to device: {}, title: {}", deviceToken, title);

            // 模拟推送成功
            return true;

        } catch (Exception e) {
            log.error("Failed to push via FCM: {}", deviceToken, e);
            return false;
        }
    }

    @Override
    public boolean batchPush(java.util.List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("FCM push is disabled");
            return false;
        }

        try {
            // FCM支持批量推送到多个token
            Map<String, Object> message = new HashMap<>();
            message.put("notification", Map.of(
                    "title", title,
                    "body", content
            ));
            message.put("data", extra != null ? extra : new HashMap<>());
            message.put("android", Map.of(
                    "priority", "high",
                    "notification", Map.of(
                            "channel_id", "default_channel"
                    )
            ));

            // 批量推送
            for (String token : deviceTokens) {
                message.put("token", token);
                log.info("Batch FCM push to device: {}", token);
            }

            // TODO: 实际批量推送逻辑
            return true;

        } catch (Exception e) {
            log.error("Failed to batch push via FCM", e);
            return false;
        }
    }
}