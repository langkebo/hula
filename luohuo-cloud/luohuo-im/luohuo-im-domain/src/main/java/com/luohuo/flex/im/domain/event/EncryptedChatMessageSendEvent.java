package com.luohuo.flex.im.domain.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * 加密聊天消息发送事件
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Getter
public class EncryptedChatMessageSendEvent extends ApplicationEvent {

    private final Long encryptedMessageId;
    private final Long normalMessageId;
    private final Long roomId;
    private final Long senderId;

    public EncryptedChatMessageSendEvent(Long encryptedMessageId, Long normalMessageId,
                                       Long roomId, Long senderId) {
        super(encryptedMessageId);
        this.encryptedMessageId = encryptedMessageId;
        this.normalMessageId = normalMessageId;
        this.roomId = roomId;
        this.senderId = senderId;
    }
}