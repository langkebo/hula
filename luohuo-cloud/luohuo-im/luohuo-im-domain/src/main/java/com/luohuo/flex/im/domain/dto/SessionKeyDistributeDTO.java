package com.luohuo.flex.im.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * E2EE会话密钥分发DTO
 *
 * 用于RocketMQ通知接收者有新的密钥包
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionKeyDistributeDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 密钥包ID
     */
    private Long keyPackageId;

    /**
     * 会话ID
     */
    private String sessionId;

    /**
     * 发送者ID
     */
    private Long senderId;

    /**
     * 接收者ID
     */
    private Long recipientId;

    /**
     * 租户ID
     */
    private Long tenantId;
}
