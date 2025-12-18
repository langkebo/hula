package com.luohuo.flex.im.domain.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * 会话密钥分发事件
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Getter
public class SessionKeyDistributedEvent extends ApplicationEvent {

    private final Long keyPackageId;
    private final String sessionId;
    private final Long senderId;
    private final Long recipientId;

    public SessionKeyDistributedEvent(Long keyPackageId, String sessionId,
                                    Long senderId, Long recipientId) {
        super(keyPackageId);
        this.keyPackageId = keyPackageId;
        this.sessionId = sessionId;
        this.senderId = senderId;
        this.recipientId = recipientId;
    }
}