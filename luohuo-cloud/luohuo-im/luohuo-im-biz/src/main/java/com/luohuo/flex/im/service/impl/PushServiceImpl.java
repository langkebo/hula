package com.luohuo.flex.im.service.impl;

import com.luohuo.flex.im.api.PushService;
import com.luohuo.flex.im.api.PushStatistics;
import com.luohuo.flex.im.domain.entity.PushDevice;
import com.luohuo.flex.im.mapper.PushDeviceMapper;
import com.luohuo.flex.im.push.PushProvider;
import com.luohuo.flex.im.push.PushType;
import com.luohuo.flex.im.service.PushRetryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 推送服务实现
 *
 * @author HuLa
 */
@Slf4j
@Service
public class PushServiceImpl implements PushService {

    private final PushDeviceMapper pushDeviceMapper;
    private final Map<PushType, PushProvider> pushProviders;
    private final PushRetryService pushRetryService;

    @Autowired
    public PushServiceImpl(PushDeviceMapper pushDeviceMapper, List<PushProvider> providers, PushRetryService pushRetryService) {
        this.pushDeviceMapper = pushDeviceMapper;
        this.pushProviders = providers.stream()
                .collect(Collectors.toMap(PushProvider::getType, provider -> provider));
        this.pushRetryService = pushRetryService;
    }

    @Override
    public boolean pushToUser(Long userId, String title, String content, Object extra) {
        try {
            // 获取用户的所有活跃设备
            List<PushDevice> devices = pushDeviceMapper.selectActiveDevicesByUserId(userId);
            if (devices.isEmpty()) {
                log.warn("No active devices found for user: {}", userId);
                return false;
            }

            boolean success = false;
            Map<String, Object> extraMap = extra != null ? (Map<String, Object>) extra : new HashMap<>();

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
                    boolean pushResult = provider.batchPush(tokens, title, content, extraMap);
                    if (pushResult) {
                        success = true;
                        log.debug("Push successful for user: {}, type: {}", userId, deviceType);
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

    @Override
    public int pushToUsers(List<Long> userIds, String title, String content, Object extra) {
        int successCount = 0;
        for (Long userId : userIds) {
            if (pushToUser(userId, title, content, extra)) {
                successCount++;
            }
        }
        return successCount;
    }

    @Override
    public boolean pushToAll(String title, String content, Object extra) {
        try {
            // 获取所有活跃设备
            List<PushDevice> allDevices = pushDeviceMapper.selectAllActiveDevices();
            if (allDevices.isEmpty()) {
                log.warn("No active devices found");
                return false;
            }

            boolean success = false;
            Map<String, Object> extraMap = extra != null ? (Map<String, Object>) extra : new HashMap<>();

            // 按设备类型分组推送
            Map<String, List<String>> deviceTokensByType = allDevices.stream()
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
                    boolean pushResult = provider.batchPush(tokens, title, content, extraMap);
                    if (pushResult) {
                        success = true;
                        log.debug("Broadcast push successful for type: {}", deviceType);
                    }
                }
            }

            return success;

        } catch (Exception e) {
            log.error("Failed to broadcast push", e);
            return false;
        }
    }

    @Override
    public int pushToGroup(Long groupId, Long excludeUserId, String title, String content, Object extra) {
        try {
            // 获取群组成员的所有活跃设备
            List<PushDevice> devices = pushDeviceMapper.selectActiveDevicesByGroupId(groupId, excludeUserId);
            if (devices.isEmpty()) {
                log.warn("No active devices found for group: {}", groupId);
                return 0;
            }

            int successCount = 0;
            Map<String, Object> extraMap = extra != null ? (Map<String, Object>) extra : new HashMap<>();

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
                    boolean pushResult = provider.batchPush(tokens, title, content, extraMap);
                    if (pushResult) {
                        successCount += tokens.size();
                        log.debug("Group push successful for group: {}, type: {}", groupId, deviceType);
                    }
                }
            }

            return successCount;

        } catch (Exception e) {
            log.error("Failed to push to group: {}", groupId, e);
            return 0;
        }
    }

    @Override
    public boolean pushNotification(Long userId, String type, String content, Object extra) {
        // 根据通知类型设置不同的标题
        String title = switch (type) {
            case "friend_request" -> "好友请求";
            case "group_invite" -> "群组邀请";
            case "system" -> "系统通知";
            default -> "新消息";
        };

        Map<String, Object> extraMap = new HashMap<>();
        extraMap.put("type", type);
        if (extra != null) {
            extraMap.putAll((Map<String, Object>) extra);
        }

        return pushToUser(userId, title, content, extraMap);
    }

    @Override
    public PushStatistics getStatistics(Long startTime, Long endTime) {
        // TODO: 实现统计逻辑，从数据库查询推送记录
        return PushStatistics.builder()
                .totalCount(1000L)
                .successCount(950L)
                .failureCount(50L)
                .apnsCount(300L)
                .fcmCount(500L)
                .huaweiCount(200L)
                .build();
    }

    private PushType convertDeviceTypeToPushType(String deviceType) {
        return switch (deviceType.toLowerCase()) {
            case "ios" -> PushType.APNS;
            case "android" -> PushType.FCM;
            default -> throw new IllegalArgumentException("Unknown device type: " + deviceType);
        };
    }
}