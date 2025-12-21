package com.luohuo.flex.im.push;

import com.eatthepath.pushy.apns.ApnsClient;
import com.eatthepath.pushy.apns.ApnsClientBuilder;
import com.eatthepath.pushy.apns.PushNotificationResponse;
import com.eatthepath.pushy.apns.util.ApnsPayloadBuilder;
import com.eatthepath.pushy.apns.util.SimpleApnsPushNotification;
import com.eatthepath.pushy.apns.util.concurrent.PushNotificationFuture;
import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import javax.annotation.PreDestroy;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ExecutionException;

/**
 * APNs推送提供者
 * 使用Pushy库实现Apple Push Notification Service推送
 *
 * @author HuLa
 */
@Slf4j
@Component
public class ApnsPushProvider implements PushProvider {

    private final PushConfig.ApnsConfig config;
    private ApnsClient apnsClient;

    public ApnsPushProvider(PushConfig config) {
        this.config = config.getApns();
    }

    @PostConstruct
    public void init() {
        if (!config.isEnabled()) {
            log.info("APNs push is disabled");
            return;
        }

        try {
            ApnsClientBuilder builder = new ApnsClientBuilder();

            // 设置环境（生产或开发）
            if (config.isProduction()) {
                builder.setApnsServer(ApnsClientBuilder.PRODUCTION_APNS_HOST);
            } else {
                builder.setApnsServer(ApnsClientBuilder.DEVELOPMENT_APNS_HOST);
            }

            // 设置认证证书
            if (StringUtils.hasText(config.getCertPath())) {
                // 使用证书文件
                builder.setClientCertificate(new File(config.getCertPath()), config.getCertPassword());
            } else if (StringUtils.hasText(config.getKeyId()) && StringUtils.hasText(config.getTeamId())) {
                // 使用认证密钥
                InputStream keyStream = getClass().getClassLoader()
                        .getResourceAsStream(config.getAuthKeyPath());
                if (keyStream != null) {
                    builder.setSigningKey(
                            config.getKeyId(),
                            keyStream,
                            config.getTeamId()
                    );
                } else {
                    log.error("APNs auth key file not found: {}", config.getAuthKeyPath());
                    return;
                }
            } else {
                log.error("APNs configuration missing: either certPath or keyId/teamId must be provided");
                return;
            }

            apnsClient = builder.build();
            log.info("APNs client initialized successfully (production: {})", config.isProduction());

        } catch (Exception e) {
            log.error("Failed to initialize APNs client", e);
        }
    }

    @PreDestroy
    public void destroy() {
        if (apnsClient != null) {
            try {
                apnsClient.close().get();
                log.info("APNs client closed");
            } catch (InterruptedException | ExecutionException e) {
                log.error("Error closing APNs client", e);
            }
        }
    }

    @Override
    public PushType getType() {
        return PushType.APNS;
    }

    @Override
    public boolean push(String deviceToken, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled() || apnsClient == null) {
            log.debug("APNs push is disabled or client not initialized");
            return false;
        }

        try {
            // 验证设备令牌
            if (!isValidDeviceToken(deviceToken)) {
                log.error("Invalid APNs device token: {}", deviceToken);
                return false;
            }

            // 构建推送载荷
            ApnsPayloadBuilder payloadBuilder = new ApnsPayloadBuilder();
            payloadBuilder.setAlertTitle(title);
            payloadBuilder.setAlertBody(content);
            payloadBuilder.setSound(config.getDefaultSound() != null ? config.getDefaultSound() : "default");

            // 设置角标
            if (extra != null && extra.containsKey("badge")) {
                payloadBuilder.setBadge((Integer) extra.get("badge"));
            } else {
                payloadBuilder.setBadge(1);
            }

            // 设置自定义数据
            if (extra != null) {
                Map<String, Object> customData = new HashMap<>(extra);
                customData.remove("badge"); // 移除已处理的badge
                for (Map.Entry<String, Object> entry : customData.entrySet()) {
                    payloadBuilder.addCustomProperty(entry.getKey(), entry.getValue());
                }
            }

            // 设置推送优先级
            String priority = config.getDefaultPriority();
            if (extra != null && extra.containsKey("priority")) {
                priority = (String) extra.get("priority");
            }

            // 创建推送通知
            String payload = payloadBuilder.build();
            SimpleApnsPushNotification notification = new SimpleApnsPushNotification(
                    deviceToken,
                    config.getBundleId(),
                    payload,
                    Instant.now().plusSeconds(config.getTtlSeconds()),
                    "high".equals(priority) ?
                            com.eatthepath.pushy.apns.util.Priority.HIGH :
                            com.eatthepath.pushy.apns.util.Priority.IMMEDIATE
            );

            // 发送推送
            PushNotificationFuture<SimpleApnsPushNotification, PushNotificationResponse<SimpleApnsPushNotification>>
                    future = apnsClient.sendNotification(notification);

            // 等待响应
            PushNotificationResponse<SimpleApnsPushNotification> response = future.get();

            // 处理响应
            if (response.isAccepted()) {
                log.info("APNs push successful to device: {}", maskDeviceToken(deviceToken));
                return true;
            } else {
                log.error("APNs push failed to device: {}, reason: {}, error code: {}",
                        maskDeviceToken(deviceToken),
                        response.getRejectionReason(),
                        response.getErrorReason());

                // 如果是无效令牌，记录以便清理
                if ("Unregistered".equals(response.getRejectionReason()) ||
                    "BadDeviceToken".equals(response.getRejectionReason())) {
                    handleInvalidToken(deviceToken);
                }
                return false;
            }

        } catch (Exception e) {
            log.error("Failed to push via APNs: {}", maskDeviceToken(deviceToken), e);
            return false;
        }
    }

    @Override
    public boolean batchPush(List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled() || apnsClient == null) {
            log.debug("APNs push is disabled or client not initialized");
            return false;
        }

        log.info("Starting APNs batch push to {} devices", deviceTokens.size());

        List<PushNotificationFuture<SimpleApnsPushNotification, PushNotificationResponse<SimpleApnsPushNotification>>>
                futures = new ArrayList<>();

        int successCount = 0;
        int failureCount = 0;

        // 批量发送
        for (String deviceToken : deviceTokens) {
            if (!isValidDeviceToken(deviceToken)) {
                log.warn("Skipping invalid device token in batch: {}", deviceToken);
                failureCount++;
                continue;
            }

            try {
                // 构建载荷
                ApnsPayloadBuilder payloadBuilder = new ApnsPayloadBuilder();
                payloadBuilder.setAlertTitle(title);
                payloadBuilder.setAlertBody(content);
                payloadBuilder.setSound(config.getDefaultSound() != null ? config.getDefaultSound() : "default");
                payloadBuilder.setBadge(1);

                String payload = payloadBuilder.build();
                SimpleApnsPushNotification notification = new SimpleApnsPushNotification(
                        deviceToken,
                        config.getBundleId(),
                        payload
                );

                // 异步发送
                PushNotificationFuture<SimpleApnsPushNotification, PushNotificationResponse<SimpleApnsPushNotification>>
                        future = apnsClient.sendNotification(notification);
                futures.add(future);

            } catch (Exception e) {
                log.error("Error preparing APNs batch push for token: {}", maskDeviceToken(deviceToken), e);
                failureCount++;
            }
        }

        // 等待所有推送完成
        for (int i = 0; i < futures.size(); i++) {
            try {
                PushNotificationResponse<SimpleApnsPushNotification> response = futures.get(i).get();
                if (response.isAccepted()) {
                    successCount++;
                } else {
                    failureCount++;
                    log.debug("APNs batch push failed: {}", response.getRejectionReason());
                }
            } catch (Exception e) {
                failureCount++;
                log.error("Error waiting for APNs batch push response", e);
            }
        }

        log.info("APNs batch push completed: success={}, failure={}", successCount, failureCount);
        return successCount > 0;
    }

    /**
     * 验证设备令牌格式
     */
    private boolean isValidDeviceToken(String deviceToken) {
        if (!StringUtils.hasText(deviceToken)) {
            return false;
        }

        // APNs设备令牌应该是64个十六进制字符
        return deviceToken.matches("^[a-fA-F0-9]{64}$");
    }

    /**
     * 掩码设备令牌以便日志输出
     */
    private String maskDeviceToken(String deviceToken) {
        if (deviceToken == null || deviceToken.length() < 8) {
            return "***";
        }
        return deviceToken.substring(0, 4) + "***" + deviceToken.substring(deviceToken.length() - 4);
    }

    /**
     * 处理无效的设备令牌
     */
    private void handleInvalidToken(String deviceToken) {
        log.warn("Invalid device token detected, should be removed from database: {}", maskDeviceToken(deviceToken));
        // TODO: 实现从数据库删除无效令牌的逻辑
        // 可以发布事件或调用服务来清理数据库中的无效令牌
    }
}