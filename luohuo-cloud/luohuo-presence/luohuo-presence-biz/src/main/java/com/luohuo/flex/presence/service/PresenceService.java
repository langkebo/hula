package com.luohuo.flex.presence.service;

import com.luohuo.flex.presence.dto.UserPresenceDTO;
import com.luohuo.flex.presence.dto.GroupPresenceDTO;
import com.luohuo.flex.presence.enums.PresenceStatus;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 用户在线状态服务接口
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
public interface PresenceService {

    /**
     * 更新用户在线状态
     *
     * @param userId     用户ID
     * @param status     状态
     * @param deviceId   设备ID
     * @param platform   平台
     * @param lastActive 最后活跃时间
     */
    void updateUserPresence(Long userId, PresenceStatus status, String deviceId,
                           String platform, Long lastActive);

    /**
     * 获取用户在线状态
     *
     * @param userId 用户ID
     * @return 用户在线状态信息
     */
    UserPresenceDTO getUserPresence(Long userId);

    /**
     * 批量获取用户在线状态
     *
     * @param userIds 用户ID列表
     * @return 用户ID到状态信息的映射
     */
    Map<Long, UserPresenceDTO> batchGetUserPresence(List<Long> userIds);

    /**
     * 更新群组在线统计
     *
     * @param groupId 群组ID
     * @param onlineCount 在线人数
     * @param totalCount 总人数
     */
    void updateGroupPresence(String groupId, Integer onlineCount, Integer totalCount);

    /**
     * 获取群组在线统计
     *
     * @param groupId 群组ID
     * @return 群组在线统计信息
     */
    GroupPresenceDTO getGroupPresence(String groupId);

    /**
     * 获取用户的设备列表
     *
     * @param userId 用户ID
     * @return 设备ID集合
     */
    Set<String> getUserDevices(Long userId);

    /**
     * 用户下线
     *
     * @param userId   用户ID
     * @param deviceId 设备ID
     */
    void userOffline(Long userId, String deviceId);

    /**
     * 用户全量下线
     *
     * @param userId 用户ID
     */
    void userOfflineAll(Long userId);

    /**
     * 推送状态变更通知
     *
     * @param userId 用户ID
     * @param status 新状态
     */
    void pushPresenceNotification(Long userId, PresenceStatus status);

    /**
     * 获取在线用户总数
     *
     * @return 在线用户总数
     */
    Long getOnlineUserCount();

    /**
     * 清理过期状态数据
     */
    void cleanExpiredPresence();

}