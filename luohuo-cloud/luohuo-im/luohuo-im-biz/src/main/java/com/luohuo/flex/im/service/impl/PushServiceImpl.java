package com.luohuo.flex.im.service.impl;

import com.luohuo.flex.im.api.PushService;
import com.luohuo.flex.im.api.PushStatistics;
import com.luohuo.flex.im.domain.entity.PushDevice;
import com.luohuo.flex.im.domain.entity.PushRecord;
import com.luohuo.flex.im.mapper.PushDeviceMapper;
import com.luohuo.flex.im.push.PushProvider;
import com.luohuo.flex.im.push.PushType;
import com.luohuo.flex.im.service.PushRecordService;
import com.luohuo.flex.im.service.PushRetryService;
import com.luohuo.flex.im.service.impl.PushRecordServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    private final PushRecordService pushRecordService;

    @Autowired
    public PushServiceImpl(PushDeviceMapper pushDeviceMapper, List<PushProvider> providers, 
                          PushRetryService pushRetryService, PushRecordService pushRecordService) {
        this.pushDeviceMapper = pushDeviceMapper;
        this.pushProviders = providers.stream()
                .collect(Collectors.toMap(PushProvider::getType, provider -> provider));
        this.pushRetryService = pushRetryService;
        this.pushRecordService = pushRecordService;
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
            Map<String, List<PushDevice>> devicesByType = devices.stream()
                    .filter(device -> device.getActive() != null && device.getActive())
                    .collect(Collectors.groupingBy(PushDevice::getDeviceType));

            for (Map.Entry<String, List<PushDevice>> entry : devicesByType.entrySet()) {
                String deviceType = entry.getKey();
                List<PushDevice> typeDevices = entry.getValue();
                List<String> tokens = typeDevices.stream()
                        .map(PushDevice::getDeviceToken)
                        .collect(Collectors.toList());

                PushType pushType = convertDeviceTypeToPushType(deviceType);
                PushProvider provider = pushProviders.get(pushType);

                if (provider != null) {
                    // 为每个设备创建推送记录
                    List<PushRecord> records = new ArrayList<>();
                    for (PushDevice device : typeDevices) {
                        PushRecord record = pushRecordService.createRecord(
                                userId, device.getDeviceToken(), pushType.name().toLowerCase(),
                                title, content, extraMap);
                        records.add(record);
                    }

                    // 执行推送
                    boolean pushResult = provider.batchPush(tokens, title, content, extraMap);
                    
                    // 更新推送记录状态
                    String status = pushResult ? PushRecordServiceImpl.STATUS_SUCCESS : PushRecordServiceImpl.STATUS_FAILED;
                    String errorMessage = pushResult ? null : "Push failed";
                    for (PushRecord record : records) {
                        pushRecordService.updateStatus(record.getId(), status, errorMessage);
                    }

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
        if (userIds == null || userIds.isEmpty()) {
            return 0;
        }

        try {
            // 批量查询所有用户的设备，解决N+1查询问题
            List<PushDevice> allDevices = pushDeviceMapper.selectActiveDevicesByUserIds(userIds);
            if (allDevices.isEmpty()) {
                log.warn("No active devices found for users: {}", userIds.size());
                return 0;
            }

            Map<String, Object> extraMap = extra != null ? (Map<String, Object>) extra : new HashMap<>();

            // 按设备类型分组推送
            Map<String, List<String>> deviceTokensByType = allDevices.stream()
                    .filter(device -> device.getActive() != null && device.getActive())
                    .collect(Collectors.groupingBy(
                            PushDevice::getDeviceType,
                            Collectors.mapping(PushDevice::getDeviceToken, Collectors.toList())
                    ));

            int successCount = 0;
            for (Map.Entry<String, List<String>> entry : deviceTokensByType.entrySet()) {
                String deviceType = entry.getKey();
                List<String> tokens = entry.getValue();

                PushType pushType = convertDeviceTypeToPushType(deviceType);
                PushProvider provider = pushProviders.get(pushType);

                if (provider != null) {
                    boolean pushResult = provider.batchPush(tokens, title, content, extraMap);
                    if (pushResult) {
                        successCount += tokens.size();
                        log.debug("Batch push successful for type: {}, count: {}", deviceType, tokens.size());
                    }
                } else {
                    log.warn("No push provider found for type: {}", deviceType);
                }
            }

            // 统计成功推送的用户数（去重）
            Set<Long> successUserIds = allDevices.stream()
                    .map(PushDevice::getUserId)
                    .collect(Collectors.toSet());
            return successUserIds.size();

        } catch (Exception e) {
            log.error("Failed to batch push to users", e);
            return 0;
        }
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
        try {
            // 将时间戳转换为 LocalDateTime
            LocalDateTime startDateTime = null;
            LocalDateTime endDateTime = null;
            
            if (startTime != null) {
                startDateTime = LocalDateTime.ofInstant(
                    Instant.ofEpochMilli(startTime), ZoneId.systemDefault());
            }
            if (endTime != null) {
                endDateTime = LocalDateTime.ofInstant(
                    Instant.ofEpochMilli(endTime), ZoneId.systemDefault());
            }
            
            // 使用 PushRecordService 获取真实统计数据
            return pushRecordService.getStatistics(startDateTime, endDateTime);
                    
        } catch (Exception e) {
            log.error("Failed to get push statistics", e);
            // 返回空统计数据而不是Mock数据
            return PushStatistics.builder()
                    .totalCount(0L)
                    .successCount(0L)
                    .failureCount(0L)
                    .apnsCount(0L)
                    .fcmCount(0L)
                    .huaweiCount(0L)
                    .xiaomiCount(0L)
                    .oppoCount(0L)
                    .vivoCount(0L)
                    .build();
        }
    }

    private PushType convertDeviceTypeToPushType(String deviceType) {
        return switch (deviceType.toLowerCase()) {
            case "ios" -> PushType.APNS;
            case "android" -> PushType.FCM;
            default -> throw new IllegalArgumentException("Unknown device type: " + deviceType);
        };
    }
}