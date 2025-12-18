package com.luohuo.flex.im.service;

import com.luohuo.flex.im.domain.entity.PushDevice;
import com.luohuo.flex.im.mapper.PushDeviceMapper;
import com.luohuo.flex.im.push.PushProvider;
import com.luohuo.flex.im.push.PushType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 增强的推送服务，集成重试机制
 *
 * @author HuLa
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EnhancedPushService {

    private final PushDeviceMapper pushDeviceMapper;
    private final Map<PushType, PushProvider> pushProviders;
    private final PushRetryService pushRetryService;

    /**
     * 推送消息给单个用户（带重试）
     *
     * @param userId 用户ID
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @return 是否成功
     */
    public boolean pushToUserWithRetry(Long userId, String title, String content, Map<String, Object> extra) {
        try {
            // 获取用户的所有活跃设备
            List<PushDevice> devices = pushDeviceMapper.selectActiveDevicesByUserId(userId);
            if (devices.isEmpty()) {
                log.warn("No active devices found for user: {}", userId);
                return false;
            }

            boolean success = false;
            Map<String, Object> extraMap = extra != null ? extra : new HashMap<>();

            // 按设备类型分组推送
            Map<String, List<String>> deviceTokensByType = devices.stream()
                    .filter(device -> device.getActive() != null && device.getActive())
                    .collect(Collectors.groupingBy(
                            PushDevice::getDeviceType,
                            Collectors.mapping(PushDevice::getDeviceToken, Collectors.toList())
                    ));

            for (Map.Entry<String, List<String>> entry : deviceTokensByType.entrySet()) {
                String deviceType = entry.getKey();
                List<String> tokens = entry.getValue();

                PushType pushType = convertDeviceTypeToPushType(deviceType);
                PushProvider provider = pushProviders.get(pushType);

                if (provider != null) {
                    for (String token : tokens) {
                        boolean pushResult = provider.push(token, title, content, extraMap);
                        if (!pushResult) {
                            // 推送失败，添加重试任务
                            pushRetryService.addRetryTask(
                                    pushType.name(),
                                    token,
                                    title,
                                    content,
                                    extraMap,
                                    0
                            );
                            log.warn("Push failed, added to retry queue: {}, device: {}", userId, token);
                        } else {
                            success = true;
                            log.debug("Push successful for user: {}, type: {}", userId, deviceType);
                        }
                    }
                } else {
                    log.warn("No push provider found for type: {}", deviceType);
                }
            }

            return success;

        } catch (Exception e) {
            log.error("Failed to push to user: {}", userId, e);
            return false;
        }
    }

    /**
     * 批量推送（带重试）
     *
     * @param deviceTokens 设备Token列表
     * @param pushType 推送类型
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @return 成功数量
     */
    public int batchPushWithRetry(List<String> deviceTokens, PushType pushType,
                                  String title, String content, Map<String, Object> extra) {
        PushProvider provider = pushProviders.get(pushType);
        if (provider == null) {
            log.warn("No push provider found for type: {}", pushType);
            return 0;
        }

        int successCount = 0;
        for (String token : deviceTokens) {
            boolean result = provider.push(token, title, content, extra);
            if (!result) {
                // 推送失败，添加重试任务
                pushRetryService.addRetryTask(
                        pushType.name(),
                        token,
                        title,
                        content,
                        extra,
                        0
                );
            } else {
                successCount++;
            }
        }

        return successCount;
    }

    private PushType convertDeviceTypeToPushType(String deviceType) {
        return switch (deviceType.toLowerCase()) {
            case "ios" -> PushType.APNS;
            case "android" -> PushType.FCM;
            default -> throw new IllegalArgumentException("Unknown device type: " + deviceType);
        };
    }
}