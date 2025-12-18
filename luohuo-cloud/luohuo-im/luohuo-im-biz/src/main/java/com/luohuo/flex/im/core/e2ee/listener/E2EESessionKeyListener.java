package com.luohuo.flex.im.core.e2ee.listener;

import com.luohuo.basic.context.ContextUtil;
import com.luohuo.basic.service.MQProducer;
import com.luohuo.flex.common.constant.MqConstant;
import com.luohuo.flex.im.domain.dto.SessionKeyDistributeDTO;
import com.luohuo.flex.im.domain.event.SessionKeyDistributedEvent;
import jakarta.annotation.Resource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * E2EE会话密钥分发监听器
 *
 * 功能：
 * 1. 监听SessionKeyDistributedEvent事件
 * 2. 将密钥分发通知发送到RocketMQ
 * 3. 通过MQ通知接收者有新的密钥包
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Component
public class E2EESessionKeyListener {

    @Resource
    private MQProducer mqProducer;

    /**
     * 会话密钥分发通知
     */
    @TransactionalEventListener(phase = TransactionPhase.BEFORE_COMMIT, classes = SessionKeyDistributedEvent.class, fallbackExecution = true)
    public void notifyKeyPackageDistribution(SessionKeyDistributedEvent event) {
        log.info("通知会话密钥分发，密钥包ID: {}, 会话ID: {}, 接收者: {}",
                event.getKeyPackageId(), event.getSessionId(), event.getRecipientId());

        // 构建MQ消息DTO
        SessionKeyDistributeDTO dto = SessionKeyDistributeDTO.builder()
                .keyPackageId(event.getKeyPackageId())
                .sessionId(event.getSessionId())
                .senderId(event.getSenderId())
                .recipientId(event.getRecipientId())
                .tenantId(ContextUtil.getTenantId())
                .build();

        // 发送到RocketMQ，用于通知接收者
        mqProducer.sendSecureMsg(MqConstant.E2EE_SESSION_KEY_TOPIC, dto, event.getKeyPackageId());

        log.debug("会话密钥分发通知已发送到MQ，密钥包ID: {}", event.getKeyPackageId());
    }
}
