package com.luohuo.flex.im.core.e2ee.listener;

import com.luohuo.basic.context.ContextUtil;
import com.luohuo.basic.service.MQProducer;
import com.luohuo.flex.common.constant.MqConstant;
import com.luohuo.flex.im.domain.dto.MessageReadNotificationDTO;
import com.luohuo.flex.im.core.e2ee.event.MessageReadEvent;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * E2EE消息已读监听器
 *
 * 功能：
 * 1. 监听MessageReadEvent事件
 * 2. 发送已读回执给发送方
 * 3. 通知客户端消息已读状态变更
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Component
public class E2EEMessageReadListener {

    @Resource
    private MQProducer mqProducer;

    /**
     * 处理消息已读事件
     * 在事务提交后执行，确保数据库已更新
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, classes = MessageReadEvent.class, fallbackExecution = true)
    public void handleMessageRead(MessageReadEvent event) {
        log.info("处理消息已读事件，消息ID: {}, 会话ID: {}, 阅读者: {}",
            event.getMessageId(), event.getConversationId(), event.getReaderId());

        try {
            // 构建已读通知DTO
            MessageReadNotificationDTO dto = MessageReadNotificationDTO.builder()
                .messageId(event.getMessageId())
                .conversationId(event.getConversationId())
                .senderId(event.getSenderId())
                .readerId(event.getReaderId())
                .readAtTimestamp(event.getReadAtTimestamp())
                .tenantId(ContextUtil.getTenantId())
                .build();

            // 发送已读回执到MQ（推送给发送方）
            // 发送方会收到通知，得知接收方已阅读消息
            mqProducer.sendSecureMsg(MqConstant.E2EE_MSG_READ_TOPIC, dto, event.getMessageId());

            log.info("消息已读通知已发送到MQ，消息ID: {}, 发送方: {}",
                event.getMessageId(), event.getSenderId());

        } catch (Exception e) {
            log.error("处理消息已读事件失败，消息ID: {}", event.getMessageId(), e);
            // 不抛出异常，避免影响主流程
        }
    }

    /**
     * 处理消息已读的额外逻辑
     * 例如：更新统计、触发自毁倒计时等
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, classes = MessageReadEvent.class, fallbackExecution = true)
    public void handleMessageReadExtra(MessageReadEvent event) {
        log.debug("处理消息已读额外逻辑，消息ID: {}", event.getMessageId());

        try {
            // 可以在这里添加额外的业务逻辑：
            // 1. 更新会话未读计数
            // 2. 触发通知提醒
            // 3. 记录用户行为统计
            // 4. 触发自毁消息倒计时（前端处理）

            log.debug("消息已读额外逻辑处理完成，消息ID: {}", event.getMessageId());

        } catch (Exception e) {
            log.error("处理消息已读额外逻辑失败，消息ID: {}", event.getMessageId(), e);
        }
    }
}
