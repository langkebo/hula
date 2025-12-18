package com.luohuo.flex.presence.service.impl;

import com.alibaba.fastjson2.JSON;
import com.luohuo.flex.presence.dto.GroupPresenceDTO;
import com.luohuo.flex.presence.dto.UserPresenceDTO;
import com.luohuo.flex.presence.enums.PresenceStatus;
import com.luohuo.flex.presence.service.PresenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.rocketmq.spring.core.RocketMQTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 用户在线状态服务实现
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PresenceServiceImpl implements PresenceService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final RocketMQTemplate rocketMQTemplate;

    // Redis Key 前缀
    private static final String USER_PRESENCE_KEY_PREFIX = "presence:user:";
    private static final String GROUP_PRESENCE_KEY_PREFIX = "presence:group:";
    private static final String USER_DEVICES_KEY_PREFIX = "presence:devices:";
    private static final String ONLINE_USERS_KEY = "presence:online:users";

    // 过期时间（分钟）
    private static final long PRESENCE_EXPIRE_MINUTES = 30;
    private static final long GROUP_PRESENCE_EXPIRE_MINUTES = 60;

    @Override
    public void updateUserPresence(Long userId, PresenceStatus status, String deviceId,
                                   String platform, Long lastActive) {
        log.debug("更新用户状态，用户ID: {}, 状态: {}, 设备: {}", userId, status, deviceId);

        // 构建设备信息
        UserPresenceDTO.DeviceInfo deviceInfo = UserPresenceDTO.DeviceInfo.builder()
                .deviceId(deviceId)
                .platform(platform)
                .lastActiveTime(LocalDateTime.now())
                .build();

        // 获取用户当前状态
        UserPresenceDTO currentPresence = getUserPresence(userId);

        if (currentPresence == null) {
            // 首次设置
            currentPresence = UserPresenceDTO.builder()
                    .userId(userId)
                    .status(status)
                    .lastActiveTime(LocalDateTime.now())
                    .devices(new HashMap<>())
                    .groupIds(new ArrayList<>())
                    .build();
        }

        // 更新设备信息
        currentPresence.getDevices().put(deviceId, deviceInfo);

        // 如果有任何设备在线，则用户状态为在线
        if (status == PresenceStatus.ONLINE) {
            currentPresence.setStatus(PresenceStatus.ONLINE);
        } else if (status == PresenceStatus.OFFLINE && currentPresence.getDevices().size() == 1) {
            // 唯一设备离线
            currentPresence.setStatus(PresenceStatus.OFFLINE);
        }

        currentPresence.setLastActiveTime(LocalDateTime.now());

        // 保存到Redis
        String userKey = USER_PRESENCE_KEY_PREFIX + userId;
        redisTemplate.opsForValue().set(userKey, currentPresence, PRESENCE_EXPIRE_MINUTES, TimeUnit.MINUTES);

        // 更新用户设备列表
        String devicesKey = USER_DEVICES_KEY_PREFIX + userId;
        redisTemplate.opsForSet().add(devicesKey, deviceId);
        redisTemplate.expire(devicesKey, PRESENCE_EXPIRE_MINUTES, TimeUnit.MINUTES);

        // 更新在线用户集合
        if (status == PresenceStatus.ONLINE) {
            redisTemplate.opsForSet().add(ONLINE_USERS_KEY, userId.toString());
        } else if (status == PresenceStatus.OFFLINE && currentPresence.getDevices().isEmpty()) {
            redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, userId.toString());
        }

        // 推送状态变更通知
        pushPresenceNotification(userId, currentPresence.getStatus());
    }

    @Override
    public UserPresenceDTO getUserPresence(Long userId) {
        String userKey = USER_PRESENCE_KEY_PREFIX + userId;
        Object presenceObj = redisTemplate.opsForValue().get(userKey);

        if (presenceObj != null) {
            try {
                return JSON.parseObject(presenceObj.toString(), UserPresenceDTO.class);
            } catch (Exception e) {
                log.error("解析用户状态失败，用户ID: {}", userId, e);
            }
        }

        return null;
    }

    @Override
    public Map<Long, UserPresenceDTO> batchGetUserPresence(List<Long> userIds) {
        Map<Long, UserPresenceDTO> result = new HashMap<>();

        if (userIds == null || userIds.isEmpty()) {
            return result;
        }

        List<String> keys = userIds.stream()
                .map(userId -> USER_PRESENCE_KEY_PREFIX + userId)
                .collect(Collectors.toList());

        List<Object> presenceList = redisTemplate.opsForValue().multiGet(keys);

        for (int i = 0; i < userIds.size() && i < presenceList.size(); i++) {
            Object presenceObj = presenceList.get(i);
            if (presenceObj != null) {
                try {
                    UserPresenceDTO presence = JSON.parseObject(presenceObj.toString(), UserPresenceDTO.class);
                    result.put(userIds.get(i), presence);
                } catch (Exception e) {
                    log.error("解析用户状态失败，用户ID: {}", userIds.get(i), e);
                }
            }
        }

        return result;
    }

    @Override
    public void updateGroupPresence(String groupId, Integer onlineCount, Integer totalCount) {
        log.debug("更新群组状态，群组ID: {}, 在线: {}, 总数: {}", groupId, onlineCount, totalCount);

        GroupPresenceDTO groupPresence = GroupPresenceDTO.builder()
                .groupId(groupId)
                .onlineCount(onlineCount)
                .totalCount(totalCount)
                .awayCount(0)  // 默认值，实际应该从统计获取
                .busyCount(0)
                .invisibleCount(0)
                .lastUpdateTime(LocalDateTime.now())
                .build();

        // 计算在线率
        groupPresence.setOnlineRate(groupPresence.calculateOnlineRate());

        // 保存到Redis
        String groupKey = GROUP_PRESENCE_KEY_PREFIX + groupId;
        redisTemplate.opsForValue().set(groupKey, groupPresence, GROUP_PRESENCE_EXPIRE_MINUTES, TimeUnit.MINUTES);
    }

    @Override
    public GroupPresenceDTO getGroupPresence(String groupId) {
        String groupKey = GROUP_PRESENCE_KEY_PREFIX + groupId;
        Object presenceObj = redisTemplate.opsForValue().get(groupKey);

        if (presenceObj != null) {
            try {
                return JSON.parseObject(presenceObj.toString(), GroupPresenceDTO.class);
            } catch (Exception e) {
                log.error("解析群组状态失败，群组ID: {}", groupId, e);
            }
        }

        return null;
    }

    @Override
    public Set<String> getUserDevices(Long userId) {
        String devicesKey = USER_DEVICES_KEY_PREFIX + userId;
        Set<Object> members = redisTemplate.opsForSet().members(devicesKey);
        if (members == null) {
            return new java.util.HashSet<>();
        }
        return members.stream()
                .map(Object::toString)
                .collect(java.util.stream.Collectors.toSet());
    }

    @Override
    public void userOffline(Long userId, String deviceId) {
        log.debug("用户设备下线，用户ID: {}, 设备: {}", userId, deviceId);

        UserPresenceDTO presence = getUserPresence(userId);
        if (presence != null && presence.getDevices() != null) {
            // 移除设备
            presence.getDevices().remove(deviceId);

            // 如果没有设备在线，则用户状态为离线
            if (presence.getDevices().isEmpty()) {
                presence.setStatus(PresenceStatus.OFFLINE);
                redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, userId.toString());
            }

            // 更新状态
            presence.setLastActiveTime(LocalDateTime.now());
            String userKey = USER_PRESENCE_KEY_PREFIX + userId;
            redisTemplate.opsForValue().set(userKey, presence, PRESENCE_EXPIRE_MINUTES, TimeUnit.MINUTES);

            // 从设备集合中移除
            String devicesKey = USER_DEVICES_KEY_PREFIX + userId;
            redisTemplate.opsForSet().remove(devicesKey, deviceId);
        }
    }

    @Override
    public void userOfflineAll(Long userId) {
        log.debug("用户全量下线，用户ID: {}", userId);

        // 删除用户状态
        String userKey = USER_PRESENCE_KEY_PREFIX + userId;
        redisTemplate.delete(userKey);

        // 删除设备列表
        String devicesKey = USER_DEVICES_KEY_PREFIX + userId;
        redisTemplate.delete(devicesKey);

        // 从在线用户集合中移除
        redisTemplate.opsForSet().remove(ONLINE_USERS_KEY, userId.toString());
    }

    @Override
    public void pushPresenceNotification(Long userId, PresenceStatus status) {
        // 构建通知消息
        Map<String, Object> notification = new HashMap<>();
        notification.put("type", "presence_update");
        notification.put("userId", userId);
        notification.put("status", status);
        notification.put("timestamp", System.currentTimeMillis());

        // 发送到RocketMQ
        rocketMQTemplate.convertAndSend("presence-notification-topic", notification);

        log.debug("推送状态通知，用户ID: {}, 状态: {}", userId, status);
    }

    @Override
    public Long getOnlineUserCount() {
        return redisTemplate.opsForSet().size(ONLINE_USERS_KEY);
    }

    @Override
    public void cleanExpiredPresence() {
        log.info("开始清理过期状态数据");

        // 清理过期的用户状态（通过Redis的TTL自动处理）
        // 这里可以添加额外的清理逻辑，比如检查最后活跃时间等

        log.info("清理过期状态数据完成");
    }

}