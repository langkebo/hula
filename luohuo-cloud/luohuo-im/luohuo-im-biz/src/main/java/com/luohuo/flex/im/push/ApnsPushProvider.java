package com.luohuo.flex.im.push;

import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * APNs推送提供者
 *
 * @author HuLa
 */
@Slf4j
@Component
public class ApnsPushProvider implements PushProvider {

    private final PushConfig.ApnsConfig config;

    public ApnsPushProvider(PushConfig config) {
        this.config = config.getApns();
    }

    @Override
    public PushType getType() {
        return PushType.APNS;
    }

    @Override
    public boolean push(String deviceToken, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("APNs push is disabled");
            return false;
        }

        try {
            // 构建推送载荷
            Map<String, Object> payload = new HashMap<>();
            payload.put("alert", Map.of(
                    "title", title,
                    "body", content
            ));
            payload.put("sound", "default");
            payload.put("badge", 1);

            if (extra != null) {
                payload.putAll(extra);
            }

            // TODO: 实际APNs推送逻辑
            // 使用com.eatthepath.pushy-apns库进行推送
            log.info("APNs push to device: {}, title: {}", deviceToken, title);

            // 模拟推送成功
            return true;

        } catch (Exception e) {
            log.error("Failed to push via APNs: {}", deviceToken, e);
            return false;
        }
    }

    @Override
    public boolean batchPush(java.util.List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        int successCount = 0;
        for (String token : deviceTokens) {
            if (push(token, title, content, extra)) {
                successCount++;
            }
        }
        return successCount > 0;
    }
}