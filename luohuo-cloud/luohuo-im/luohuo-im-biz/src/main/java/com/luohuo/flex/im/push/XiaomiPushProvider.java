package com.luohuo.flex.im.push;

import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 小米推送提供者
 *
 * @author HuLa
 */
@Slf4j
@Component
public class XiaomiPushProvider implements PushProvider {

    private final PushConfig.XiaomiConfig config;

    public XiaomiPushProvider(PushConfig config) {
        this.config = config.getXiaomi();
    }

    @Override
    public PushType getType() {
        return PushType.XIAOMI;
    }

    @Override
    public boolean push(String deviceToken, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("Xiaomi push is disabled");
            return false;
        }

        try {
            // 构建小米推送消息
            Map<String, Object> message = new HashMap<>();
            message.put("title", title);
            message.put("description", content);
            message.put("notify_type", 1); // 使用默认提示音

            // 构建额外的payload
            Map<String, Object> payload = new HashMap<>();
            if (extra != null) {
                payload.putAll(extra);
            }
            message.put("extra", payload);

            // 构建请求参数
            Map<String, Object> params = new HashMap<>();
            params.put("restricted_package_name", config.getPackageName());
            params.put("pass_through", 0); // 0表示通知栏消息，1表示透传消息
            params.put("payload", message.toString());
            params.put("registration_id", deviceToken);

            // TODO: 实际小米推送逻辑
            // 使用小米推送SDK进行推送
            // 1. 获取access_token
            // 2. 调用小米推送API
            log.info("Xiaomi push to device: {}, title: {}", deviceToken, title);

            // 模拟推送成功
            return true;

        } catch (Exception e) {
            log.error("Failed to push via Xiaomi: {}", deviceToken, e);
            return false;
        }
    }

    @Override
    public boolean batchPush(java.util.List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("Xiaomi push is disabled");
            return false;
        }

        try {
            // 小米支持批量推送（最多1000个设备）
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
            message.put("description", content);
            message.put("notify_type", 1);

            Map<String, Object> payload = new HashMap<>();
            if (extra != null) {
                payload.putAll(extra);
            }
            message.put("extra", payload);

            // 构建请求参数
            Map<String, Object> params = new HashMap<>();
            params.put("restricted_package_name", config.getPackageName());
            params.put("pass_through", 0);
            params.put("payload", message.toString());
            params.put("registration_id", String.join(",", deviceTokens));

            // TODO: 实际批量推送逻辑
            log.info("Batch Xiaomi push to {} devices", deviceTokens.size());
            return true;

        } catch (Exception e) {
            log.error("Failed to batch push via Xiaomi", e);
            return false;
        }
    }
}