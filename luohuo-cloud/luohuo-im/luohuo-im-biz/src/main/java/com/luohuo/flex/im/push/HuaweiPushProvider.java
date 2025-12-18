package com.luohuo.flex.im.push;

import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 华为推送提供者
 *
 * @author HuLa
 */
@Slf4j
@Component
public class HuaweiPushProvider implements PushProvider {

    private final PushConfig.HuaweiConfig config;

    public HuaweiPushProvider(PushConfig config) {
        this.config = config.getHuawei();
    }

    @Override
    public PushType getType() {
        return PushType.HUAWEI;
    }

    @Override
    public boolean push(String deviceToken, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("Huawei push is disabled");
            return false;
        }

        try {
            // 构建华为推送消息
            Map<String, Object> message = new HashMap<>();
            message.put("title", title);
            message.put("content", content);

            // 构建通知栏消息
            Map<String, Object> notification = new HashMap<>();
            notification.put("title", title);
            notification.put("body", content);
            notification.put("sound", "default");
            notification.put("vibrate", "1");
            notification.put("notify_summary", "您有一条新消息");

            // 构建点击动作
            Map<String, Object> action = new HashMap<>();
            action.put("type", 1);
            action.put("intent", "#Intent;com.huawei.codelabpush.activity.DeepLinkActivity;end");

            // 构建Android配置
            Map<String, Object> androidConfig = new HashMap<>();
            androidConfig.put("notification", notification);
            androidConfig.put("action", action);
            if (extra != null) {
                androidConfig.put("custom_map", extra);
            }

            message.put("android", androidConfig);
            message.put("token", deviceToken);

            // TODO: 实际华为推送逻辑
            // 获取access_token并调用华为推送API
            log.info("Huawei push to device: {}, title: {}", deviceToken, title);

            // 模拟推送成功
            return true;

        } catch (Exception e) {
            log.error("Failed to push via Huawei: {}", deviceToken, e);
            return false;
        }
    }

    @Override
    public boolean batchPush(java.util.List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("Huawei push is disabled");
            return false;
        }

        int successCount = 0;
        for (String token : deviceTokens) {
            if (push(token, title, content, extra)) {
                successCount++;
            }
        }
        return successCount > 0;
    }
}