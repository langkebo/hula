package com.luohuo.flex.im.core.e2ee.listener;

import com.luohuo.basic.context.ContextUtil;
import com.luohuo.basic.service.MQProducer;
import com.luohuo.flex.common.constant.MqConstant;
import com.luohuo.flex.im.domain.dto.MessageDestructNotificationDTO;
import com.luohuo.flex.im.core.e2ee.event.MessageDestructedEvent;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * E2EE消息销毁监听器
 *
 * 功能：
 * 1. 监听MessageDestructedEvent事件
 * 2. 通知双方客户端消息已销毁
 * 3. 触发前端清理本地缓存
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Component
public class E2EEMessageDestructListener {

    @Resource
    private MQProducer mqProducer;

    /**
     * 处理消息销毁事件
     * 在事务提交后执行，确保消息已从数据库删除
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, classes = MessageDestructedEvent.class, fallbackExecution = true)
    public void handleMessageDestruct(MessageDestructedEvent event) {
        log.info("处理消息销毁事件，消息ID: {}, 会话ID: {}", event.getMessageId(), event.getConversationId());

        try {
            // 构建销毁通知DTO
            MessageDestructNotificationDTO dto = MessageDestructNotificationDTO.builder()
                .messageId(event.getMessageId())
                .conversationId(event.getConversationId())
                .senderId(event.getSenderId())
                .recipientId(event.getRecipientId())
                .roomId(event.getRoomId())
                .tenantId(ContextUtil.getTenantId())
                .destructedAt(System.currentTimeMillis())
                .build();

            // 发送销毁通知到MQ（推送给发送方和接收方）
            // 客户端收到通知后，应从本地存储中删除该消息
            mqProducer.sendSecureMsg(MqConstant.E2EE_MSG_DESTRUCT_TOPIC, dto, event.getMessageId());

            log.info("消息销毁通知已发送到MQ，消息ID: {}, 会话ID: {}",
                event.getMessageId(), event.getConversationId());

        } catch (Exception e) {
            log.error("处理消息销毁事件失败，消息ID: {}", event.getMessageId(), e);
            // 不抛出异常，避免影响主流程
        }
    }

    /**
     * 处理消息销毁的额外逻辑
     * 例如：统计、审计等
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, classes = MessageDestructedEvent.class, fallbackExecution = true)
    public void handleMessageDestructExtra(MessageDestructedEvent event) {
        log.debug("处理消息销毁额外逻辑，消息ID: {}", event.getMessageId());

        try {
            // 可以在这里添加额外的业务逻辑：
            // 1. 更新自毁消息统计
            // 2. 记录销毁日志（已在service层处理）
            // 3. 触发清理关联数据
            // 4. 更新会话状态

            // 如果是群消息，通知所有成员
            if (event.isGroupMessage()) {
                log.debug("群消息已销毁，房间ID: {}", event.getRoomId());
                // 群消息销毁逻辑可以在这里扩展
            }

            // 如果是私聊消息，通知双方
            if (event.isPrivateMessage()) {
                log.debug("私聊消息已销毁，发送方: {}, 接收方: {}",
                    event.getSenderId(), event.getRecipientId());
            }

            log.debug("消息销毁额外逻辑处理完成，消息ID: {}", event.getMessageId());

        } catch (Exception e) {
            log.error("处理消息销毁额外逻辑失败，消息ID: {}", event.getMessageId(), e);
        }
    }
}
