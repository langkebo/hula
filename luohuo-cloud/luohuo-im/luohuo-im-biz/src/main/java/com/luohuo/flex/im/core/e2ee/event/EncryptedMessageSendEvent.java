package com.luohuo.flex.im.core.e2ee.event;

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
public class EncryptedMessageSendEvent extends ApplicationEvent {

    /**
     * 消息ID
     */
    private Long messageId;

    /**
     * 会话ID
     */
    private String conversationId;

    /**
     * 发送者ID
     */
    private Long senderId;

    /**
     * 接收者ID
     */
    private Long recipientId;

    /**
     * 房间ID
     */
    private Long roomId;

    public EncryptedMessageSendEvent(Long messageId, String conversationId,
                                   Long senderId, Long recipientId, Long roomId) {
        super(messageId);
        this.messageId = messageId;
        this.conversationId = conversationId;
        this.senderId = senderId;
        this.recipientId = recipientId;
        this.roomId = roomId;
    }

    /**
     * 是否是群消息
     */
    public boolean isGroupMessage() {
        return roomId != null && roomId > 0;
    }

    /**
     * 是否是私聊消息
     */
    public boolean isPrivateMessage() {
        return recipientId != null && recipientId > 0;
    }
}