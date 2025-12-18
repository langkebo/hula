package com.luohuo.flex.im.api;

import java.util.List;

/**
 * 推送服务接口
 *
 * @author HuLa
 */
public interface PushService {

    /**
     * 推送消息给单个用户
     *
     * @param userId 用户ID
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @return 是否成功
     */
    boolean pushToUser(Long userId, String title, String content, Object extra);

    /**
     * 批量推送消息
     *
     * @param userIds 用户ID列表
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @return 成功推送的用户数
     */
    int pushToUsers(List<Long> userIds, String title, String content, Object extra);

    /**
     * 推送给所有用户
     *
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @return 是否成功
     */
    boolean pushToAll(String title, String content, Object extra);

    /**
     * 推送给群组
     *
     * @param groupId 群组ID
     * @param excludeUserId 排除的用户ID
     * @param title 标题
     * @param content 内容
     * @param extra 扩展信息
     * @return 成功推送的用户数
     */
    int pushToGroup(Long groupId, Long excludeUserId, String title, String content, Object extra);

    /**
     * 推送系统通知
     *
     * @param userId 用户ID
     * @param type 通知类型
     * @param content 内容
     * @param extra 扩展信息
     * @return 是否成功
     */
    boolean pushNotification(Long userId, String type, String content, Object extra);

    /**
     * 获取推送统计信息
     *
     * @param startTime 开始时间
     * @param endTime 结束时间
     * @return 统计信息
     */
    PushStatistics getStatistics(Long startTime, Long endTime);
}