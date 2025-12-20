package com.luohuo.flex.im.push;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.flex.im.config.PushConfig;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 小米推送提供者
 * 
 * 小米推送API文档: https://dev.mi.com/console/doc/detail?pId=1163
 *
 * @author HuLa
 */
@Slf4j
@Component
public class XiaomiPushProvider implements PushProvider {

    private static final String XIAOMI_PUSH_URL = "https://api.xmpush.xiaomi.com/v3/message/regid";
    private static final String XIAOMI_BATCH_PUSH_URL = "https://api.xmpush.xiaomi.com/v2/message/regids";
    private static final int MAX_BATCH_SIZE = 1000;

    private final PushConfig.XiaomiConfig config;
    private final OkHttpClient httpClient;
    private final ObjectMapper objectMapper;

    public XiaomiPushProvider(PushConfig config) {
        this.config = config.getXiaomi();
        this.objectMapper = new ObjectMapper();
        this.httpClient = new OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
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
            return sendToXiaomi(deviceToken, title, content, extra);
        } catch (Exception e) {
            log.error("Failed to push via Xiaomi: {}", deviceToken, e);
            return false;
        }
    }

    @Override
    public boolean batchPush(List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        if (!config.isEnabled()) {
            log.debug("Xiaomi push is disabled");
            return false;
        }

        if (deviceTokens == null || deviceTokens.isEmpty()) {
            return false;
        }

        try {
            // 小米支持批量推送（最多1000个设备）
            if (deviceTokens.size() > MAX_BATCH_SIZE) {
                return batchPushInChunks(deviceTokens, title, content, extra);
            }

            return sendBatchToXiaomi(deviceTokens, title, content, extra);
        } catch (Exception e) {
            log.error("Failed to batch push via Xiaomi", e);
            return false;
        }
    }

    /**
     * 分批推送（每批最多1000个设备）
     */
    private boolean batchPushInChunks(List<String> deviceTokens, String title, String content, Map<String, Object> extra) {
        int successCount = 0;
        for (int i = 0; i < deviceTokens.size(); i += MAX_BATCH_SIZE) {
            int endIndex = Math.min(i + MAX_BATCH_SIZE, deviceTokens.size());
            List<String> batch = deviceTokens.subList(i, endIndex);
            try {
                if (sendBatchToXiaomi(batch, title, content, extra)) {
                    successCount += batch.size();
                }
            } catch (Exception e) {
                log.error("Failed to push batch {} to {}", i, endIndex, e);
            }
        }
        return successCount > 0;
    }

    /**
     * 发送单个推送到小米
     */
    private boolean sendToXiaomi(String deviceToken, String title, String content, Map<String, Object> extra) throws IOException {
        // 构建payload JSON
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", title);
        payload.put("description", content);
        if (extra != null && !extra.isEmpty()) {
            payload.put("extra", extra);
        }
        String payloadJson = objectMapper.writeValueAsString(payload);

        // 构建表单参数
        FormBody.Builder formBuilder = new FormBody.Builder()
                .add("registration_id", deviceToken)
                .add("payload", payloadJson)
                .add("restricted_package_name", config.getPackageName())
                .add("pass_through", "0")  // 0: 通知栏消息
                .add("notify_type", "1");  // 1: 使用默认提示音

        Request request = new Request.Builder()
                .url(XIAOMI_PUSH_URL)
                .addHeader("Authorization", "key=" + config.getAppSecret())
                .addHeader("Content-Type", "application/x-www-form-urlencoded")
                .post(formBuilder.build())
                .build();

        return executeRequest(request, deviceToken);
    }

    /**
     * 批量发送推送到小米
     */
    private boolean sendBatchToXiaomi(List<String> deviceTokens, String title, String content, Map<String, Object> extra) throws IOException {
        // 构建payload JSON
        Map<String, Object> payload = new HashMap<>();
        payload.put("title", title);
        payload.put("description", content);
        if (extra != null && !extra.isEmpty()) {
            payload.put("extra", extra);
        }
        String payloadJson = objectMapper.writeValueAsString(payload);

        // 小米批量推送使用逗号分隔的registration_id
        String registrationIds = String.join(",", deviceTokens);

        FormBody.Builder formBuilder = new FormBody.Builder()
                .add("registration_id", registrationIds)
                .add("payload", payloadJson)
                .add("restricted_package_name", config.getPackageName())
                .add("pass_through", "0")
                .add("notify_type", "1");

        Request request = new Request.Builder()
                .url(XIAOMI_BATCH_PUSH_URL)
                .addHeader("Authorization", "key=" + config.getAppSecret())
                .addHeader("Content-Type", "application/x-www-form-urlencoded")
                .post(formBuilder.build())
                .build();

        return executeRequest(request, "batch[" + deviceTokens.size() + "]");
    }

    /**
     * 执行HTTP请求并处理响应
     */
    private boolean executeRequest(Request request, String target) throws IOException {
        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.error("Xiaomi push failed with HTTP status: {} for target: {}", response.code(), target);
                return false;
            }

            ResponseBody body = response.body();
            if (body == null) {
                log.error("Xiaomi push response body is null for target: {}", target);
                return false;
            }

            String responseBody = body.string();
            JsonNode jsonNode = objectMapper.readTree(responseBody);
            
            // 小米推送响应格式: {"result":"ok","trace_id":"xxx","code":0,"data":{"id":"xxx"},"description":"成功","info":"xxx"}
            int code = jsonNode.has("code") ? jsonNode.get("code").asInt() : -1;
            String result = jsonNode.has("result") ? jsonNode.get("result").asText() : "";
            
            if (code == 0 && "ok".equalsIgnoreCase(result)) {
                log.debug("Xiaomi push successful for target: {}", target);
                return true;
            } else {
                String description = jsonNode.has("description") ? jsonNode.get("description").asText() : "Unknown error";
                log.error("Xiaomi push failed for target: {}, code: {}, description: {}", target, code, description);
                
                // 处理特定错误码
                handleErrorCode(code, target);
                return false;
            }
        }
    }

    /**
     * 处理小米推送错误码
     */
    private void handleErrorCode(int code, String target) {
        switch (code) {
            case 20301 -> log.warn("Xiaomi: Invalid registration_id for target: {}", target);
            case 20302 -> log.warn("Xiaomi: Registration_id not subscribed for target: {}", target);
            case 20303 -> log.warn("Xiaomi: Invalid package name for target: {}", target);
            case 20401 -> log.warn("Xiaomi: Invalid app secret");
            case 20500 -> log.warn("Xiaomi: Server internal error");
            default -> log.warn("Xiaomi: Unknown error code: {} for target: {}", code, target);
        }
    }
}
