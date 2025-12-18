package com.luohuo.flex.im.push;

import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * OPPO推送提供者
 *
 * @author HuLa
 */
@Slf4j
@Component
public class OppoPushProvider implements PushProvider {

    private final PushConfig.OppoConfig config;

    public OppoPushProvider(PushConfig config) {
        this.config = config.getOppo();
    }

    @Override
    public PushType getType() {
        return PushType.OPPO;
    }

    @Override
    public boolean push(String deviceToken, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("OPPO push is disabled");
            return false;
        }

        try {
            // 构建OPPO推送消息
            Map<String, Object> message = new HashMap<>();
            message.put("title", title);
            message.put("content", content);
            message.put("click_action_type", 1); // 打开应用
            message.put("click_action_activity", ""); // 指定打开的Activity
            message.put("action_parameters", extra != null ? extra : new HashMap<>());

            // 构建通知栏样式
            Map<String, Object> style = new HashMap<>();
            style.put("notify_id", System.currentTimeMillis()); // 通知栏ID
            style.put("small_icon", ""); // 小图标
            style.put("large_icon", ""); // 大图标
            style.put("large_picture_url", ""); // 大图
            message.put("style", style);

            // TODO: 实际OPPO推送逻辑
            // 1. 获取auth_token（使用appKey、appSecret、masterSecret）
            // 2. 调用OPPO推送API
            log.info("OPPO push to device: {}, title: {}", deviceToken, title);

            // 模拟推送成功
            return true;

        } catch (Exception e) {
            log.error("Failed to push via OPPO: {}", deviceToken, e);
            return false;
        }
    }

    @Override
    public boolean batchPush(java.util.List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("OPPO push is disabled");
            return false;
        }

        try {
            // OPPO批量推送（最多1000个设备）
            if (deviceTokens.size() > 1000) {
                // 分批推送
                int successCount = 0;
                for (int i = 0; i < deviceTokens.size(); i += 1000) {
                    int endIndex = Math.min(i + 1000, deviceTokens.size());
                    java.util.List<String> batch = deviceTokens.subList(i, endIndex);
                    if (batchPush(batch, title, content, extra)) {
                        successCount += batch.size();
                    }
                }
                return successCount > 0;
            }

            // 构建批量推送消息
            Map<String, Object> message = new HashMap<>();
            message.put("title", title);
            message.put("content", content);
            message.put("click_action_type", 1);
            message.put("action_parameters", extra != null ? extra : new HashMap<>());
            message.put("target_type", 2); // 2: registration_id_list
            message.put("target_value", String.join(",", deviceTokens));

            // TODO: 实际批量推送逻辑
            log.info("Batch OPPO push to {} devices", deviceTokens.size());
            return true;

        } catch (Exception e) {
            log.error("Failed to batch push via OPPO", e);
            return false;
        }
    }
}