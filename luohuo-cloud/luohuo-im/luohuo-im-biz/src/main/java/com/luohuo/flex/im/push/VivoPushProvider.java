package com.luohuo.flex.im.push;

import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * vivo推送提供者
 *
 * @author HuLa
 */
@Slf4j
@Component
public class VivoPushProvider implements PushProvider {

    private final PushConfig.VivoConfig config;

    public VivoPushProvider(PushConfig config) {
        this.config = config.getVivo();
    }

    @Override
    public PushType getType() {
        return PushType.VIVO;
    }

    @Override
    public boolean push(String deviceToken, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("Vivo push is disabled");
            return false;
        }

        try {
            // 构建vivo推送消息
            Map<String, Object> message = new HashMap<>();
            message.put("title", title);
            message.put("content", content);
            message.put("skipType", 1); // 1:打开app首页
            message.put("skipContent", ""); // 跳转内容
            message.put("networkType", 0); // 0:不限网络类型

            // 设置扩展参数
            if (extra != null) {
                Map<String, Object> extraParams = new HashMap<>();
                extra.forEach((key, value) -> {
                    if (value instanceof String) {
                        extraParams.put(key, value);
                    } else {
                        extraParams.put(key, String.valueOf(value));
                    }
                });
                message.put("extra", extraParams);
            }

            // 设置推送时间
            message.put("pushTimeType", 0); // 0:立即推送
            message.put("pushStartTime", "");
            message.put("pushEndTime", "");

            // TODO: 实际vivo推送逻辑
            // 1. 获取auth_token（使用appId、appKey、appSecret）
            // 2. 调用vivo推送API
            log.info("Vivo push to device: {}, title: {}", deviceToken, title);

            // 模拟推送成功
            return true;

        } catch (Exception e) {
            log.error("Failed to push via Vivo: {}", deviceToken, e);
            return false;
        }
    }

    @Override
    public boolean batchPush(java.util.List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("Vivo push is disabled");
            return false;
        }

        try {
            // vivo批量推送（最多1000个设备）
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
            message.put("skipType", 1);
            message.put("networkType", 0);
            message.put("regId", String.join(",", deviceTokens));

            // 设置扩展参数
            if (extra != null) {
                Map<String, Object> extraParams = new HashMap<>();
                extra.forEach((key, value) -> {
                    if (value instanceof String) {
                        extraParams.put(key, value);
                    } else {
                        extraParams.put(key, String.valueOf(value));
                    }
                });
                message.put("extra", extraParams);
            }

            // TODO: 实际批量推送逻辑
            log.info("Batch Vivo push to {} devices", deviceTokens.size());
            return true;

        } catch (Exception e) {
            log.error("Failed to batch push via Vivo", e);
            return false;
        }
    }
}