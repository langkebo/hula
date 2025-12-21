package com.luohuo.flex.im.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.time.Instant;
import java.util.*;

/**
 * 华为推送提供者
 * 使用华为Push Kit服务实现推送功能
 *
 * @author HuLa
 */
@Slf4j
@Component
public class HuaweiPushProvider implements PushProvider {

    private final PushConfig.HuaweiConfig config;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private String accessToken;
    private Instant tokenExpireTime;

    // 华为推送API端点
    private static final String OAUTH_URL = "https://oauth-login.cloud.huawei.com/oauth2/v1/token";
    private static final String PUSH_URL = "https://push-api.cloud.huawei.com/v1/{appId}/messages:send";

    public HuaweiPushProvider(PushConfig config) {
        this.config = config.getHuawei();
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
                .build();
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void init() {
        if (!config.isEnabled()) {
            log.info("Huawei push is disabled");
            return;
        }

        if (!StringUtils.hasText(config.getAppId()) || !StringUtils.hasText(config.getAppSecret())) {
            log.error("Huawei push configuration missing: appId and appSecret must be provided");
            return;
        }

        // 预先获取访问令牌
        refreshToken();
        log.info("Huawei push provider initialized");
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
            // 验证设备令牌
            if (!isValidDeviceToken(deviceToken)) {
                log.error("Invalid Huawei device token: {}", deviceToken);
                return false;
            }

            // 确保有有效的访问令牌
            if (accessToken == null || tokenExpireTime == null || Instant.now().isAfter(tokenExpireTime)) {
                refreshToken();
            }

            // 构建推送消息
            Map<String, Object> message = buildPushMessage(deviceToken, title, content, extra);
            String messageJson = objectMapper.writeValueAsString(message);

            // 发送推送请求
            String url = PUSH_URL.replace("{appId}", config.getAppId());
            RequestBody body = RequestBody.create(
                    messageJson,
                    MediaType.get("application/json; charset=utf-8")
            );

            Request request = new Request.Builder()
                    .url(url)
                    .post(body)
                    .addHeader("Authorization", "Bearer " + accessToken)
                    .addHeader("Content-Type", "application/json")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (response.isSuccessful()) {
                    log.info("Huawei push successful to device: {}", maskDeviceToken(deviceToken));
                    return true;
                } else {
                    // 检查是否是令牌过期
                    if (response.code() == 401 || response.code() == 403) {
                        log.warn("Huawei push token may be expired, refreshing...");
                        refreshToken();
                        // 重试一次
                        return pushWithRetry(deviceToken, title, content, extra);
                    }

                    log.error("Huawei push failed to device: {}, code: {}, response: {}",
                            maskDeviceToken(deviceToken), response.code(), responseBody);
                    return false;
                }
            }

        } catch (Exception e) {
            log.error("Failed to push via Huawei: {}", maskDeviceToken(deviceToken), e);
            return false;
        }
    }

    @Override
    public boolean batchPush(List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("Huawei push is disabled");
            return false;
        }

        log.info("Starting Huawei batch push to {} devices", deviceTokens.size());

        int successCount = 0;
        int failureCount = 0;

        // 华为推送也支持批量推送，但为了稳定性，我们这里采用单个推送方式
        for (String deviceToken : deviceTokens) {
            if (push(deviceToken, title, content, extra)) {
                successCount++;
            } else {
                failureCount++;
            }

            // 控制频率，避免被限流
            if (deviceTokens.size() > 10) {
                try {
                    Thread.sleep(50); // 50ms延迟
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        log.info("Huawei batch push completed: success={}, failure={}", successCount, failureCount);
        return successCount > 0;
    }

    /**
     * 刷新访问令牌
     */
    private void refreshToken() {
        try {
            Map<String, String> params = new HashMap<>();
            params.put("grant_type", "client_credentials");
            params.put("client_id", config.getAppId());
            params.put("client_secret", config.getAppSecret());

            FormBody.Builder formBuilder = new FormBody.Builder();
            for (Map.Entry<String, String> entry : params.entrySet()) {
                formBuilder.add(entry.getKey(), entry.getValue());
            }

            RequestBody body = formBuilder.build();
            Request request = new Request.Builder()
                    .url(OAUTH_URL)
                    .post(body)
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";

                if (response.isSuccessful()) {
                    Map<String, Object> tokenResponse = objectMapper.readValue(responseBody, Map.class);
                    accessToken = (String) tokenResponse.get("access_token");
                    Integer expiresIn = (Integer) tokenResponse.get("expires_in");

                    // 设置过期时间，提前5分钟刷新
                    tokenExpireTime = Instant.now().plusSeconds(expiresIn - 300);

                    log.info("Huawei access token refreshed successfully");
                } else {
                    log.error("Failed to refresh Huawei access token: {} - {}", response.code(), responseBody);
                }
            }

        } catch (Exception e) {
            log.error("Error refreshing Huawei access token", e);
        }
    }

    /**
     * 构建推送消息
     */
    private Map<String, Object> buildPushMessage(String deviceToken, String title, String content, Map<String, Object> extra) {
        Map<String, Object> message = new HashMap<>();

        // 验证消息
        message.put("validate_only", false);

        // 消息体
        Map<String, Object> messageBody = new HashMap<>();

        // Android通知
        Map<String, Object> notification = new HashMap<>();
        notification.put("title", title);
        notification.put("body", content);
        notification.put("image", extra != null ? extra.get("image") : null);

        // Android配置
        Map<String, Object> androidConfig = new HashMap<>();
        androidConfig.put("collapse_key", UUID.randomUUID().toString());
        androidConfig.put("urgency", "high");
        androidConfig.put("ttl", config.getTtlSeconds() != null ? config.getTtlSeconds() + "s" : "3600s");
        androidConfig.put("notification", notification);

        // 如果有自定义数据
        if (extra != null && !extra.isEmpty()) {
            Map<String, String> data = new HashMap<>();
            for (Map.Entry<String, Object> entry : extra.entrySet()) {
                if (entry.getValue() != null && !"image".equals(entry.getKey())) {
                    data.put(entry.getKey(), entry.getValue().toString());
                }
            }
            androidConfig.put("data", data);
        }

        // 目标设备
        Map<String, Object> target = new HashMap<>();
        target.put("token", Collections.singletonList(deviceToken));

        // 组装消息
        messageBody.put("android", androidConfig);
        messageBody.put("target", target);
        message.put("message", messageBody);

        return message;
    }

    /**
     * 重试推送（刷新令牌后）
     */
    private boolean pushWithRetry(String deviceToken, String title, String content, Map<String, Object> extra) {
        try {
            Map<String, Object> message = buildPushMessage(deviceToken, title, content, extra);
            String messageJson = objectMapper.writeValueAsString(message);

            String url = PUSH_URL.replace("{appId}", config.getAppId());
            RequestBody body = RequestBody.create(
                    messageJson,
                    MediaType.get("application/json; charset=utf-8")
            );

            Request request = new Request.Builder()
                    .url(url)
                    .post(body)
                    .addHeader("Authorization", "Bearer " + accessToken)
                    .addHeader("Content-Type", "application/json")
                    .build();

            try (Response response = httpClient.newCall(request).execute()) {
                if (response.isSuccessful()) {
                    log.info("Huawei push retry successful to device: {}", maskDeviceToken(deviceToken));
                    return true;
                } else {
                    log.error("Huawei push retry failed to device: {}, code: {}",
                            maskDeviceToken(deviceToken), response.code());
                    return false;
                }
            }

        } catch (Exception e) {
            log.error("Huawei push retry failed: {}", maskDeviceToken(deviceToken), e);
            return false;
        }
    }

    /**
     * 验证设备令牌格式
     */
    private boolean isValidDeviceToken(String deviceToken) {
        if (!StringUtils.hasText(deviceToken)) {
            return false;
        }

        // 华为设备令牌格式验证
        // 通常是一个较长的字符串，包含数字和字母
        return deviceToken.length() >= 50 && deviceToken.matches("^[a-zA-Z0-9]+$");
    }

    /**
     * 掩码设备令牌以便日志输出
     */
    private String maskDeviceToken(String deviceToken) {
        if (deviceToken == null || deviceToken.length() < 16) {
            return "***";
        }
        return deviceToken.substring(0, 8) + "***" + deviceToken.substring(deviceToken.length() - 8);
    }
}