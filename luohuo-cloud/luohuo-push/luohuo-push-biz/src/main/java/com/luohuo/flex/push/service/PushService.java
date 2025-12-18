package com.luohuo.flex.push.service;

import com.luohuo.flex.push.model.PushMessage;
import com.luohuo.flex.push.model.PushResult;

import java.util.List;

/**
 * 推送服务接口
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
public interface PushService {

    /**
     * 发送单条推送
     *
     * @param pushMessage 推送消息
     * @return 推送结果
     */
    PushResult sendPush(PushMessage pushMessage);

    /**
     * 批量发送推送
     *
     * @param pushMessages 推送消息列表
     * @return 推送结果列表
     */
    List<PushResult> batchSendPush(List<PushMessage> pushMessages);

    /**
     * 发送推送给指定用户的所有设备
     *
     * @param userId 用户ID
     * @param pushMessage 推送消息
     * @return 推送结果列表
     */
    List<PushResult> sendPushToUser(Long userId, PushMessage pushMessage);

    /**
     * 异步发送推送
     *
     * @param pushMessage 推送消息
     */
    void sendPushAsync(PushMessage pushMessage);

    /**
     * 根据设备推送
     *
     * @param deviceToken 设备Token
     * @param platform 平台（iOS/Android）
     * @param pushMessage 推送消息
     * @return 推送结果
     */
    PushResult sendPushToDevice(String deviceToken, String platform, PushMessage pushMessage);

    /**
     * 获取推送统计信息
     *
     * @param messageId 消息ID
     * @return 统计信息
     */
    Object getPushStats(String messageId);

    /**
     * 处理推送回执
     *
     * @param messageId 消息ID
     * @param deviceToken 设备Token
     * @param status 状态
     */
    void handlePushReceipt(String messageId, String deviceToken, String status);
}