package com.luohuo.flex.im.push;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.*;
import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutionException;

/**
 * FCM推送提供者
 * 使用Firebase Admin SDK实现Firebase Cloud Messaging推送
 *
 * @author HuLa
 */
@Slf4j
@Component
public class FcmPushProvider implements PushProvider {

    private final PushConfig.FcmConfig config;
    private final ObjectMapper objectMapper;
    private FirebaseApp firebaseApp;

    public FcmPushProvider(PushConfig config) {
        this.config = config.getFcm();
        this.objectMapper = new ObjectMapper();
    }

    @PostConstruct
    public void init() {
        if (!config.isEnabled()) {
            log.info("FCM push is disabled");
            return;
        }

        try {
            // 初始化Firebase
            if (StringUtils.hasText(config.getServiceAccountJson())) {
                // 使用JSON字符串初始化
                ByteArrayInputStream serviceAccount = new ByteArrayInputStream(
                        config.getServiceAccountJson().getBytes(StandardCharsets.UTF_8));

                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(com.google.auth.oauth2.GoogleCredentials.fromStream(serviceAccount))
                        .build();

                firebaseApp = FirebaseApp.initializeApp(options, "HuLa-FCM");
                log.info("Firebase app initialized successfully from JSON string");

            } else if (StringUtils.hasText(config.getServiceAccountPath())) {
                // 使用文件路径初始化
                FirebaseOptions options = FirebaseOptions.builder()
                        .setCredentials(
                                com.google.auth.oauth2.GoogleCredentials.fromStream(
                                        getClass().getClassLoader().getResourceAsStream(config.getServiceAccountPath())
                                )
                        )
                        .build();

                firebaseApp = FirebaseApp.initializeApp(options, "HuLa-FCM");
                log.info("Firebase app initialized successfully from file: {}", config.getServiceAccountPath());

            } else {
                log.error("FCM configuration missing: either serviceAccountJson or serviceAccountPath must be provided");
                return;
            }

        } catch (IOException e) {
            log.error("Failed to initialize Firebase app", e);
        }
    }

    @Override
    public PushType getType() {
        return PushType.FCM;
    }

    @Override
    public boolean push(String deviceToken, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled() || firebaseApp == null) {
            log.debug("FCM push is disabled or Firebase app not initialized");
            return false;
        }

        try {
            // 验证设备令牌
            if (!isValidDeviceToken(deviceToken)) {
                log.error("Invalid FCM device token: {}", deviceToken);
                return false;
            }

            // 构建通知
            Notification notification = Notification.builder()
                    .setTitle(title)
                    .setBody(content)
                    .build();

            // 构建Android配置
            AndroidConfig androidConfig = AndroidConfig.builder()
                    .setPriority(AndroidConfig.Priority.HIGH)
                    .setNotification(AndroidNotification.builder()
                            .setChannelId(config.getDefaultChannelId() != null ?
                                    config.getDefaultChannelId() : "default_channel")
                            .setClickAction("FLUTTER_NOTIFICATION_CLICK")
                            .setSound(config.getDefaultSound() != null ?
                                    config.getDefaultSound() : "default")
                            .build())
                    .setTtl(config.getTtlSeconds() != null ?
                            config.getTtlSeconds() * 1000L : 3600000L) // 默认1小时
                    .build();

            // 构建APNs配置（iOS）
            ApnsConfig apnsConfig = ApnsConfig.builder()
                    .setAps(Aps.builder()
                            .setSound(config.getDefaultSound() != null ?
                                    config.getDefaultSound() : "default")
                            .setBadge(1)
                            .build())
                    .build();

            // 构建消息
            Message.Builder messageBuilder = Message.builder()
                    .setToken(deviceToken)
                    .setNotification(notification)
                    .setAndroidConfig(androidConfig)
                    .setApnsConfig(apnsConfig);

            // 添加自定义数据
            if (extra != null) {
                Map<String, String> data = new HashMap<>();
                for (Map.Entry<String, Object> entry : extra.entrySet()) {
                    if (entry.getValue() != null) {
                        data.put(entry.getKey(), entry.getValue().toString());
                    }
                }
                messageBuilder.putAllData(data);
            }

            Message message = messageBuilder.build();

            // 发送消息
            String messageId = FirebaseMessaging.getInstance(firebaseApp)
                    .sendAsync(message)
                    .get();

            log.info("FCM push successful to device: {}, messageId: {}", maskDeviceToken(deviceToken), messageId);
            return true;

        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to push via FCM: {}", maskDeviceToken(deviceToken), e);
            return false;
        } catch (Exception e) {
            log.error("Unexpected error during FCM push: {}", maskDeviceToken(deviceToken), e);
            return false;
        }
    }

    @Override
    public boolean batchPush(List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled() || firebaseApp == null) {
            log.debug("FCM push is disabled or Firebase app not initialized");
            return false;
        }

        log.info("Starting FCM batch push to {} devices", deviceTokens.size());

        if (deviceTokens.size() > 500) {
            // FCM multicast限制500个设备
            log.warn("FCM batch push exceeds 500 devices limit, splitting into multiple batches");
            return batchPushWithSplit(deviceTokens, title, content, extra, 500);
        }

        try {
            // 构建通知
            Notification notification = Notification.builder()
                    .setTitle(title)
                    .setBody(content)
                    .build();

            // 构建Android配置
            AndroidConfig androidConfig = AndroidConfig.builder()
                    .setPriority(AndroidConfig.Priority.HIGH)
                    .setNotification(AndroidNotification.builder()
                            .setChannelId(config.getDefaultChannelId() != null ?
                                    config.getDefaultChannelId() : "default_channel")
                            .setClickAction("FLUTTER_NOTIFICATION_CLICK")
                            .setSound(config.getDefaultSound() != null ?
                                    config.getDefaultSound() : "default")
                            .build())
                    .build();

            // 构建APNs配置
            ApnsConfig apnsConfig = ApnsConfig.builder()
                    .setAps(Aps.builder()
                            .setSound(config.getDefaultSound() != null ?
                                    config.getDefaultSound() : "default")
                            .setBadge(1)
                            .build())
                    .build();

            // 添加自定义数据
            Map<String, String> data = new HashMap<>();
            if (extra != null) {
                for (Map.Entry<String, Object> entry : extra.entrySet()) {
                    if (entry.getValue() != null) {
                        data.put(entry.getKey(), entry.getValue().toString());
                    }
                }
            }

            // 构建 multicast 消息
            MulticastMessage message = MulticastMessage.builder()
                    .addAllTokens(deviceTokens)
                    .setNotification(notification)
                    .setAndroidConfig(androidConfig)
                    .setApnsConfig(apnsConfig)
                    .putAllData(data)
                    .build();

            // 发送批量消息
            BatchResponse response = FirebaseMessaging.getInstance(firebaseApp)
                    .sendMulticastAsync(message)
                    .get();

            // 处理响应
            int successCount = response.getSuccessCount();
            int failureCount = response.getFailureCount();

            log.info("FCM batch push completed: success={}, failure={}", successCount, failureCount);

            // 记录失败的设备
            if (failureCount > 0) {
                List<SendResponse> responses = response.getResponses();
                for (int i = 0; i < responses.size(); i++) {
                    SendResponse sendResponse = responses.get(i);
                    if (!sendResponse.isSuccessful()) {
                        log.debug("FCM push failed for device {}: {}",
                                maskDeviceToken(deviceTokens.get(i)),
                                sendResponse.getException().getMessage());

                        // 处理无效令牌
                        if (sendResponse.getException() instanceof FirebaseMessagingException) {
                            FirebaseMessagingException fme = (FirebaseMessagingException) sendResponse.getException();
                            if (fme.getErrorCode().equals("UNREGISTERED") ||
                                fme.getErrorCode().equals("INVALID_ARGUMENT")) {
                                handleInvalidToken(deviceTokens.get(i));
                            }
                        }
                    }
                }
            }

            return successCount > 0;

        } catch (InterruptedException | ExecutionException e) {
            log.error("Failed to batch push via FCM", e);
            return false;
        } catch (Exception e) {
            log.error("Unexpected error during FCM batch push", e);
            return false;
        }
    }

    /**
     * 分批推送（当设备数超过500时）
     */
    private boolean batchPushWithSplit(List<String> deviceTokens, String title, String content,
                                      Map<String, Object> extra, int batchSize) {
        int total = deviceTokens.size();
        boolean hasSuccess = false;

        for (int i = 0; i < total; i += batchSize) {
            int endIndex = Math.min(i + batchSize, total);
            List<String> batch = deviceTokens.subList(i, endIndex);

            log.info("Processing FCM batch {}/{}, size: {}",
                    (i / batchSize) + 1, (total + batchSize - 1) / batchSize, batch.size());

            boolean result = batchPush(batch, title, content, extra);
            if (result) {
                hasSuccess = true;
            }

            // 批次间稍作延迟，避免限流
            if (i + batchSize < total) {
                try {
                    Thread.sleep(100);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }

        return hasSuccess;
    }

    /**
     * 验证设备令牌格式
     */
    private boolean isValidDeviceToken(String deviceToken) {
        if (!StringUtils.hasText(deviceToken)) {
            return false;
        }

        // FCM设备令牌长度通常在100-200字符之间
        int length = deviceToken.length();
        return length >= 100 && length <= 200;
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

    /**
     * 处理无效的设备令牌
     */
    private void handleInvalidToken(String deviceToken) {
        log.warn("Invalid device token detected, should be removed from database: {}", maskDeviceToken(deviceToken));
        // TODO: 实现从数据库删除无效令牌的逻辑
        // 可以发布事件或调用服务来清理数据库中的无效令牌
    }
}