package com.luohuo.flex.im.core.e2ee.event;

import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.context.ApplicationEvent;

/**
 * 加密消息发送事件
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
public class EncryptedChatMessageSendEvent extends ApplicationEvent {

    /**
     * 加密消息实体
     */
    private MessageEncrypted messageEncrypted;

    /**
     * 发送者ID
     */
    private Long senderId;

    /**
     * 接收者ID列表
     */
    private java.util.List<Long> recipientIds;

    /**
     * 会话ID
     */
    private String conversationId;

    public EncryptedChatMessageSendEvent(Object source, MessageEncrypted messageEncrypted) {
        super(source);
        this.messageEncrypted = messageEncrypted;
        this.senderId = messageEncrypted.getSenderId();
        this.conversationId = messageEncrypted.getConversationId();
    }
}