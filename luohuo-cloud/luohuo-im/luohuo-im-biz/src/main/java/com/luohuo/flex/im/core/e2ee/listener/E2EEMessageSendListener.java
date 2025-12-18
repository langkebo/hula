package com.luohuo.flex.im.core.e2ee.listener;

import com.luohuo.basic.context.ContextUtil;
import com.luohuo.basic.service.MQProducer;
import com.luohuo.flex.common.constant.MqConstant;
import com.luohuo.flex.im.domain.dto.E2EEMsgSendDTO;
import com.luohuo.flex.im.domain.event.EncryptedMessageSendEvent;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * E2EE加密消息发送监听器
 *
 * 功能：
 * 1. 监听EncryptedMessageSendEvent事件
 * 2. 将加密消息发送到RocketMQ
 * 3. 通过MQ进行消息路由和推送
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Component
public class E2EEMessageSendListener {

    @Resource
    private MQProducer mqProducer;

    /**
     * 加密消息路由到MQ
     * 在事务提交前执行，确保消息已保存到数据库
     */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, classes = EncryptedMessageSendEvent.class, fallbackExecution = true)
    public void routeEncryptedMessage(EncryptedMessageSendEvent event) {
        log.info("路由E2EE加密消息到MQ，消息ID: {}, 会话ID: {}", event.getMessageId(), event.getConversationId());

        // 构建MQ消息DTO
        E2EEMsgSendDTO dto = E2EEMsgSendDTO.builder()
                .messageId(event.getMessageId())
                .conversationId(event.getConversationId())
                .senderId(event.getSenderId())
                .recipientId(event.getRecipientId())
                .roomId(event.getRoomId())
                .tenantId(ContextUtil.getTenantId())
                .build();

        // 发送到RocketMQ
        mqProducer.sendSecureMsg(MqConstant.E2EE_MSG_SEND_TOPIC, dto, event.getMessageId());

        log.debug("E2EE加密消息已发送到MQ，消息ID: {}", event.getMessageId());
    }

    /**
     * 处理加密消息的后续逻辑（可选）
     * 例如：统计、审计、监控等
     */
    @TransactionalEventListener(classes = EncryptedMessageSendEvent.class, fallbackExecution = true)
    public void handleEncryptedMessageExtra(EncryptedMessageSendEvent event) {
        // 这里可以添加额外的处理逻辑
        // 例如：更新统计数据、触发其他业务流程等
        log.debug("处理E2EE加密消息额外逻辑，消息ID: {}", event.getMessageId());
    }
}
