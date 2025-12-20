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
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * vivo推送提供者
 * 
 * vivo推送API文档: https://dev.vivo.com.cn/documentCenter/doc/362
 *
 * @author HuLa
 */
@Slf4j
@Component
public class VivoPushProvider implements PushProvider {

    private static final String VIVO_AUTH_URL = "https://api-push.vivo.com.cn/message/auth";
    private static final String VIVO_PUSH_URL = "https://api-push.vivo.com.cn/message/send";
    private static final String VIVO_BATCH_PUSH_URL = "https://api-push.vivo.com.cn/message/pushToList";
    private static final String VIVO_SAVE_LIST_URL = "https://api-push.vivo.com.cn/message/saveListPayload";
    private static final int MAX_BATCH_SIZE = 1000;
    private static final long TOKEN_EXPIRE_TIME = 23 * 60 * 60 * 1000L; // 23小时（token有效期24小时）

    private final PushConfig.VivoConfig config;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;
    
    // Token缓存
    private final AtomicReference<String> cachedToken = new AtomicReference<>();
    private volatile long tokenExpireTime = 0;

    public VivoPushProvider(PushConfig config) {
        this.config = config.getVivo();
        this.objectMapper = new ObjectMapper();
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
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
            String authToken = getAuthToken();
            if (authToken == null) {
                log.error("Failed to get Vivo auth token");
                return false;
            }
            return sendToVivo(authToken, deviceToken, title, content, extra);
        } catch (Exception e) {
            log.error("Failed to push via Vivo: {}", deviceToken, e);
            return false;
        }
    }

    @Override
    public boolean batchPush(List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("Vivo push is disabled");
            return false;
        }

        if (deviceTokens == null || deviceTokens.isEmpty()) {
            return false;
        }

        try {
            String authToken = getAuthToken();
            if (authToken == null) {
                log.error("Failed to get Vivo auth token");
                return false;
            }

            // vivo批量推送（最多1000个设备）
            if (deviceTokens.size() > MAX_BATCH_SIZE) {
                return batchPushInChunks(authToken, deviceTokens, title, content, extra);
            }

            return sendBatchToVivo(authToken, deviceTokens, title, content, extra);
        } catch (Exception e) {
            log.error("Failed to batch push via Vivo", e);
            return false;
        }
    }

    /**
     * 获取Vivo认证Token（带缓存）
     */
    private synchronized String getAuthToken() throws IOException {
        // 检查缓存的token是否有效
        if (cachedToken.get() != null && System.currentTimeMillis() < tokenExpireTime) {
            return cachedToken.get();
        }

        // 生成签名: MD5(appId + appKey + timestamp + appSecret)
        long timestamp = System.currentTimeMillis();
        String signStr = config.getAppId() + config.getAppKey() + timestamp + config.getAppSecret();
        String sign = md5(signStr).toLowerCase();

        Map<String, Object> params = new HashMap<>();
        params.put("appId", config.getAppId());
        params.put("appKey", config.getAppKey());
        params.put("timestamp", timestamp);
        params.put("sign", sign);

        String jsonBody = objectMapper.writeValueAsString(params);

        RequestBody requestBody = RequestBody.create(
                jsonBody, MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(VIVO_AUTH_URL)
                .post(requestBody)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.error("Vivo auth failed with HTTP status: {}", response.code());
                return null;
            }

            ResponseBody body = response.body();
            if (body == null) {
                return null;
            }

            String responseBody = body.string();
            JsonNode jsonNode = objectMapper.readTree(responseBody);
            
            int result = jsonNode.has("result") ? jsonNode.get("result").asInt() : -1;
            if (result == 0) {
                String token = jsonNode.has("authToken") ? jsonNode.get("authToken").asText() : null;
                if (token != null) {
                    cachedToken.set(token);
                    tokenExpireTime = System.currentTimeMillis() + TOKEN_EXPIRE_TIME;
                    log.debug("Vivo auth token obtained successfully");
                    return token;
                }
            }
            
            String desc = jsonNode.has("desc") ? jsonNode.get("desc").asText() : "Unknown error";
            log.error("Vivo auth failed: result={}, desc={}", result, desc);
            return null;
        }
    }

    /**
     * 发送单个推送到Vivo
     */
    private boolean sendToVivo(String authToken, String deviceToken, String title, String content, Map<String, Object> extra) throws IOException {
        Map<String, Object> message = new HashMap<>();
        message.put("regId", deviceToken);
        message.put("notifyType", 4); // 4: 通知栏消息
        message.put("title", title);
        message.put("content", content);
        message.put("skipType", 1); // 1: 打开APP首页
        message.put("skipContent", "");
        message.put("networkType", -1); // -1: 不限网络
        message.put("requestId", UUID.randomUUID().toString());
        
        // 设置扩展参数
        if (extra != null && !extra.isEmpty()) {
            Map<String, String> extraParams = new HashMap<>();
            extra.forEach((key, value) -> extraParams.put(key, String.valueOf(value)));
            message.put("clientCustomMap", extraParams);
        }

        String jsonBody = objectMapper.writeValueAsString(message);

        RequestBody requestBody = RequestBody.create(
                jsonBody, MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(VIVO_PUSH_URL)
                .addHeader("authToken", authToken)
                .post(requestBody)
                .build();

        return executeRequest(request, deviceToken);
    }

    /**
     * 批量发送推送到Vivo
     */
    private boolean sendBatchToVivo(String authToken, List<String> deviceTokens, String title, String content, Map<String, Object> extra) throws IOException {
        // 首先保存消息内容获取taskId
        String taskId = saveListPayload(authToken, title, content, extra);
        if (taskId == null) {
            log.error("Failed to save Vivo list payload");
            return false;
        }

        // 使用taskId进行批量推送
        Map<String, Object> message = new HashMap<>();
        message.put("regIds", deviceTokens);
        message.put("taskId", taskId);
        message.put("requestId", UUID.randomUUID().toString());

        String jsonBody = objectMapper.writeValueAsString(message);

        RequestBody requestBody = RequestBody.create(
                jsonBody, MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(VIVO_BATCH_PUSH_URL)
                .addHeader("authToken", authToken)
                .post(requestBody)
                .build();

        return executeRequest(request, "batch[" + deviceTokens.size() + "]");
    }

    /**
     * 保存消息内容（用于批量推送）
     */
    private String saveListPayload(String authToken, String title, String content, Map<String, Object> extra) throws IOException {
        Map<String, Object> message = new HashMap<>();
        message.put("notifyType", 4);
        message.put("title", title);
        message.put("content", content);
        message.put("skipType", 1);
        message.put("skipContent", "");
        message.put("networkType", -1);
        message.put("requestId", UUID.randomUUID().toString());
        
        if (extra != null && !extra.isEmpty()) {
            Map<String, String> extraParams = new HashMap<>();
            extra.forEach((key, value) -> extraParams.put(key, String.valueOf(value)));
            message.put("clientCustomMap", extraParams);
        }

        String jsonBody = objectMapper.writeValueAsString(message);

        RequestBody requestBody = RequestBody.create(
                jsonBody, MediaType.parse("application/json; charset=utf-8"));

        Request request = new Request.Builder()
                .url(VIVO_SAVE_LIST_URL)
                .addHeader("authToken", authToken)
                .post(requestBody)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.error("Vivo save list payload failed with HTTP status: {}", response.code());
                return null;
            }

            ResponseBody body = response.body();
            if (body == null) {
                return null;
            }

            String responseBody = body.string();
            JsonNode jsonNode = objectMapper.readTree(responseBody);
            
            int result = jsonNode.has("result") ? jsonNode.get("result").asInt() : -1;
            if (result == 0) {
                return jsonNode.has("taskId") ? jsonNode.get("taskId").asText() : null;
            }
            
            log.error("Vivo save list payload failed: {}", responseBody);
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
                if (sendBatchToVivo(authToken, batch, title, content, extra)) {
                    successCount += batch.size();
                }
            } catch (Exception e) {
                log.error("Failed to push Vivo batch {} to {}", i, endIndex, e);
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
                log.error("Vivo push failed with HTTP status: {} for target: {}", response.code(), target);
                return false;
            }

            ResponseBody body = response.body();
            if (body == null) {
                log.error("Vivo push response body is null for target: {}", target);
                return false;
            }

            String responseBody = body.string();
            JsonNode jsonNode = objectMapper.readTree(responseBody);
            
            int result = jsonNode.has("result") ? jsonNode.get("result").asInt() : -1;
            
            if (result == 0) {
                log.debug("Vivo push successful for target: {}", target);
                return true;
            } else {
                String desc = jsonNode.has("desc") ? jsonNode.get("desc").asText() : "Unknown error";
                log.error("Vivo push failed for target: {}, result: {}, desc: {}", target, result, desc);
                handleErrorCode(result, target);
                return false;
            }
        }
    }

    /**
     * 处理Vivo推送错误码
     */
    private void handleErrorCode(int code, String target) {
        switch (code) {
            case 0 -> log.debug("Vivo: Success");
            case 10000 -> log.warn("Vivo: Invalid parameters for target: {}", target);
            case 10001 -> log.warn("Vivo: Invalid authToken");
            case 10003 -> log.warn("Vivo: Invalid regId for target: {}", target);
            case 10050 -> log.warn("Vivo: Message content too long for target: {}", target);
            case 10054 -> log.warn("Vivo: Rate limit exceeded");
            case 10070 -> log.warn("Vivo: Invalid regId (device not registered) for target: {}", target);
            default -> log.warn("Vivo: Unknown error code: {} for target: {}", code, target);
        }
    }

    /**
     * MD5加密
     */
    private String md5(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
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
            throw new RuntimeException("MD5 algorithm not found", e);
        }
    }
}
