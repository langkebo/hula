package com.luohuo.flex.im.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * OPPO推送提供者
 * 
 * OPPO推送API文档: https://open.oppomobile.com/wiki/doc#id=10196
 *
 * @author HuLa
 */
@Slf4j
@Component
public class OppoPushProvider implements PushProvider {

    private static final String OPPO_AUTH_URL = "https://api.push.oppomobile.com/server/v1/auth";
    private static final String OPPO_PUSH_URL = "https://api.push.oppomobile.com/server/v1/message/notification/unicast";
    private static final String OPPO_BATCH_PUSH_URL = "https://api.push.oppomobile.com/server/v1/message/notification/broadcast";
    private static final String OPPO_SAVE_MESSAGE_URL = "https://api.push.oppomobile.com/server/v1/message/notification/save_message_content";
    private static final int MAX_BATCH_SIZE = 1000;
    private static final long TOKEN_EXPIRE_TIME = 23 * 60 * 60 * 1000L; // 23小时（token有效期24小时）

    private final PushConfig.OppoConfig config;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    
    // Token缓存
    private final AtomicReference<String> cachedToken = new AtomicReference<>();
    private volatile long tokenExpireTime = 0;

    public OppoPushProvider(PushConfig config) {
        this.config = config.getOppo();
        this.objectMapper = new ObjectMapper();
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
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
            String authToken = getAuthToken();
            if (authToken == null) {
                log.error("Failed to get OPPO auth token");
                return false;
            }
            return sendToOppo(authToken, deviceToken, title, content, extra);
        } catch (Exception e) {
            log.error("Failed to push via OPPO: {}", deviceToken, e);
            return false;
        }
    }

    @Override
    public boolean batchPush(List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("OPPO push is disabled");
            return false;
        }

        if (deviceTokens == null || deviceTokens.isEmpty()) {
            return false;
        }

        try {
            String authToken = getAuthToken();
            if (authToken == null) {
                log.error("Failed to get OPPO auth token");
                return false;
            }

            // OPPO批量推送（最多1000个设备）
            if (deviceTokens.size() > MAX_BATCH_SIZE) {
                return batchPushInChunks(authToken, deviceTokens, title, content, extra);
            }

            return sendBatchToOppo(authToken, deviceTokens, title, content, extra);
        } catch (Exception e) {
            log.error("Failed to batch push via OPPO", e);
            return false;
        }
    }

    /**
     * 获取OPPO认证Token（带缓存）
     */
    private synchronized String getAuthToken() throws IOException {
        // 检查缓存的token是否有效
        if (cachedToken.get() != null && System.currentTimeMillis() < tokenExpireTime) {
            return cachedToken.get();
        }

        // 生成签名: SHA256(appKey + timestamp + masterSecret)
        long timestamp = System.currentTimeMillis();
        String signStr = config.getAppKey() + timestamp + config.getMasterSecret();
        String sign = sha256(signStr);

        FormBody formBody = new FormBody.Builder()
                .add("app_key", config.getAppKey())
                .add("timestamp", String.valueOf(timestamp))
                .add("sign", sign)
                .build();

        Request request = new Request.Builder()
                .url(OPPO_AUTH_URL)
                .post(formBody)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.error("OPPO auth failed with HTTP status: {}", response.code());
                return null;
            }

            ResponseBody body = response.body();
            if (body == null) {
                return null;
            }

            String responseBody = body.string();
            JsonNode jsonNode = objectMapper.readTree(responseBody);
            
            int code = jsonNode.has("code") ? jsonNode.get("code").asInt() : -1;
            if (code == 0) {
                JsonNode dataNode = jsonNode.get("data");
                if (dataNode != null && dataNode.has("auth_token")) {
                    String token = dataNode.get("auth_token").asText();
                    cachedToken.set(token);
                    tokenExpireTime = System.currentTimeMillis() + TOKEN_EXPIRE_TIME;
                    log.debug("OPPO auth token obtained successfully");
                    return token;
                }
            }
            
            String message = jsonNode.has("message") ? jsonNode.get("message").asText() : "Unknown error";
            log.error("OPPO auth failed: code={}, message={}", code, message);
            return null;
        }
    }

    /**
     * 发送单个推送到OPPO
     */
    private boolean sendToOppo(String authToken, String deviceToken, String title, String content, Map<String, Object> extra) throws IOException {
        // 构建通知消息体
        Map<String, Object> notification = new HashMap<>();
        notification.put("title", title);
        notification.put("content", content);
        notification.put("click_action_type", 0); // 0: 启动应用
        
        if (extra != null && !extra.isEmpty()) {
            notification.put("click_action_activity", extra.getOrDefault("activity", ""));
            notification.put("action_parameters", objectMapper.writeValueAsString(extra));
        }

        Map<String, Object> message = new HashMap<>();
        message.put("target_type", 2); // 2: registration_id
        message.put("target_value", deviceToken);
        message.put("notification", notification);

        String jsonBody = objectMapper.writeValueAsString(message);

        RequestBody requestBody = RequestBody.create(
                jsonBody, MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(OPPO_PUSH_URL)
                .addHeader("auth_token", authToken)
                .post(requestBody)
                .build();

        return executeRequest(request, deviceToken);
    }

    /**
     * 批量发送推送到OPPO
     */
    private boolean sendBatchToOppo(String authToken, List<String> deviceTokens, String title, String content, Map<String, Object> extra) throws IOException {
        // 首先保存消息内容获取message_id
        String messageId = saveMessageContent(authToken, title, content, extra);
        if (messageId == null) {
            log.error("Failed to save OPPO message content");
            return false;
        }

        // 使用message_id进行批量推送
        Map<String, Object> message = new HashMap<>();
        message.put("message_id", messageId);
        message.put("target_type", 2); // 2: registration_id
        message.put("target_value", String.join(";", deviceTokens));

        String jsonBody = objectMapper.writeValueAsString(message);

        RequestBody requestBody = RequestBody.create(
                jsonBody, MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(OPPO_BATCH_PUSH_URL)
                .addHeader("auth_token", authToken)
                .post(requestBody)
                .build();

        return executeRequest(request, "batch[" + deviceTokens.size() + "]");
    }

    /**
     * 保存消息内容（用于批量推送）
     */
    private String saveMessageContent(String authToken, String title, String content, Map<String, Object> extra) throws IOException {
        Map<String, Object> notification = new HashMap<>();
        notification.put("title", title);
        notification.put("content", content);
        notification.put("click_action_type", 0);
        
        if (extra != null && !extra.isEmpty()) {
            notification.put("action_parameters", objectMapper.writeValueAsString(extra));
        }

        String jsonBody = objectMapper.writeValueAsString(notification);

        RequestBody requestBody = RequestBody.create(
                jsonBody, MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(OPPO_SAVE_MESSAGE_URL)
                .addHeader("auth_token", authToken)
                .post(requestBody)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.error("OPPO save message failed with HTTP status: {}", response.code());
                return null;
            }

            ResponseBody body = response.body();
            if (body == null) {
                return null;
            }

            String responseBody = body.string();
            JsonNode jsonNode = objectMapper.readTree(responseBody);
            
            int code = jsonNode.has("code") ? jsonNode.get("code").asInt() : -1;
            if (code == 0) {
                JsonNode dataNode = jsonNode.get("data");
                if (dataNode != null && dataNode.has("message_id")) {
                    return dataNode.get("message_id").asText();
                }
            }
            
            log.error("OPPO save message failed: {}", responseBody);
            return null;
        }
    }

    /**
     * 分批推送
     */
    private boolean batchPushInChunks(String authToken, List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        int successCount = 0;
        for (int i = 0; i < deviceTokens.size(); i += MAX_BATCH_SIZE) {
            int endIndex = Math.min(i + MAX_BATCH_SIZE, deviceTokens.size());
            List<String> batch = deviceTokens.subList(i, endIndex);
            try {
                if (sendBatchToOppo(authToken, batch, title, content, extra)) {
                    successCount += batch.size();
                }
            } catch (Exception e) {
                log.error("Failed to push OPPO batch {} to {}", i, endIndex, e);
            }
        }
        return successCount > 0;
    }

    /**
     * 执行HTTP请求并处理响应
     */
    private boolean executeRequest(Request request, String target) throws IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.error("OPPO push failed with HTTP status: {} for target: {}", response.code(), target);
                return false;
            }

            ResponseBody body = response.body();
            if (body == null) {
                log.error("OPPO push response body is null for target: {}", target);
                return false;
            }

            String responseBody = body.string();
            JsonNode jsonNode = objectMapper.readTree(responseBody);
            
            int code = jsonNode.has("code") ? jsonNode.get("code").asInt() : -1;
            
            if (code == 0) {
                log.debug("OPPO push successful for target: {}", target);
                return true;
            } else {
                String message = jsonNode.has("message") ? jsonNode.get("message").asText() : "Unknown error";
                log.error("OPPO push failed for target: {}, code: {}, message: {}", target, code, message);
                handleErrorCode(code, target);
                return false;
            }
        }
    }

    /**
     * 处理OPPO推送错误码
     */
    private void handleErrorCode(int code, String target) {
        switch (code) {
            case 10000 -> log.debug("OPPO: Success");
            case 10001 -> log.warn("OPPO: Invalid parameters for target: {}", target);
            case 10002 -> log.warn("OPPO: Invalid auth_token");
            case 10003 -> log.warn("OPPO: Invalid registration_id for target: {}", target);
            case 10004 -> log.warn("OPPO: Message content too long for target: {}", target);
            case 10005 -> log.warn("OPPO: Rate limit exceeded");
            default -> log.warn("OPPO: Unknown error code: {} for target: {}", code, target);
        }
    }

    /**
     * SHA256加密
     */
    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 algorithm not found", e);
        }
    }
}
