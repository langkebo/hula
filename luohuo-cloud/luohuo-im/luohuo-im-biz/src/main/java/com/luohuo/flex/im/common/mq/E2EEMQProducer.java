package com.luohuo.flex.im.common.mq;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.basic.service.MQProducer;
import com.luohuo.flex.common.constant.MqConstant;
import com.luohuo.flex.im.domain.dto.MessageDestructNotificationDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * E2EE MQ 生产者扩展
 * 提供批量发送消息的能力
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class E2EEMQProducer {

    private final MQProducer mqProducer;
    private final ObjectMapper objectMapper;

    /**
     * 批量发送消息销毁通知
     *
     * @param notifications 销毁通知列表
     */
    public void sendBatchMessageDestructNotifications(List<MessageDestructNotificationDTO> notifications) {
        if (notifications == null || notifications.isEmpty()) {
            return;
        }

        try {
            // 批量发送
            notifications.forEach(notification -> {
                mqProducer.sendSecureMsg(MqConstant.E2EE_MSG_DESTRUCT_TOPIC, notification, notification.getMessageId());
            });

            log.info("批量发送消息销毁通知完成，数量: {}", notifications.size());

        } catch (Exception e) {
            log.error("批量发送消息销毁通知失败", e);

            // 降级处理：尝试单个发送
            notifications.forEach(notification -> {
                try {
                    mqProducer.sendSecureMsg(MqConstant.E2EE_MSG_DESTRUCT_TOPIC, notification, notification.getMessageId());
                } catch (Exception ex) {
                    log.error("发送单条消息销毁通知失败，消息ID: {}", notification.getMessageId(), ex);
                }
            });
        }
    }

    /**
     * 批量发送消息已读通知
     *
     * @param notifications 已读通知列表
     */
    public void sendBatchMessageReadNotifications(List<Object> notifications) {
        if (notifications == null || notifications.isEmpty()) {
            return;
        }

        try {
            // 批量发送
            notifications.forEach(notification -> {
                // 假设通知对象有 getMessageId 方法
                Object messageId = null;
                try {
                    messageId = notification.getClass().getMethod("getMessageId").invoke(notification);
                    mqProducer.sendSecureMsg(MqConstant.E2EE_MSG_READ_TOPIC, notification, messageId);
                } catch (Exception e) {
                    log.error("获取消息ID失败", e);
                }
            });

            log.info("批量发送消息已读通知完成，数量: {}", notifications.size());

        } catch (Exception e) {
            log.error("批量发送消息已读通知失败", e);
        }
    }
}