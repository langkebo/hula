package com.luohuo.flex.im.core.e2ee.event;

import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.context.ApplicationEvent;

/**
 * 会话密钥分发事件
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@EqualsAndHashCode(callSuper = false)
public class SessionKeyDistributedEvent extends ApplicationEvent {

    /**
     * 会话ID
     */
    private String sessionId;

    /**
     * 密钥ID
     */
    private String keyId;

    /**
     * 接收者ID
     */
    private Long recipientId;

    /**
     * 发送者ID
     */
    private Long senderId;

    /**
     * 分发是否成功
     */
    private Boolean success;

    public SessionKeyDistributedEvent(Object source, String sessionId, String keyId,
                                     Long recipientId, Long senderId, Boolean success) {
        super(source);
        this.sessionId = sessionId;
        this.keyId = keyId;
        this.recipientId = recipientId;
        this.senderId = senderId;
        this.success = success;
    }
}