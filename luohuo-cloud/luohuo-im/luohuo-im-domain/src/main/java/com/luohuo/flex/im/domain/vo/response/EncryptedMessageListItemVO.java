package com.luohuo.flex.im.domain.vo.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 加密消息列表项（轻量VO）
 * 用于列表查询，不包含大字段
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@Schema(description = "加密消息列表项（轻量）")
public class EncryptedMessageListItemVO {

    /**
     * 消息ID
     */
    @Schema(description = "消息ID", example = "123456")
    private Long id;

    /**
     * 会话ID
     */
    @Schema(description = "会话ID", example = "conv_123456")
    private String conversationId;

    /**
     * 发送者ID
     */
    @Schema(description = "发送者ID", example = "123456")
    private Long senderId;

    /**
     * 接收者ID
     */
    @Schema(description = "接收者ID", example = "654321")
    private Long recipientId;

    /**
     * 群聊ID
     */
    @Schema(description = "群聊ID", example = "1001")
    private Long roomId;

    /**
     * 会话密钥ID
     */
    @Schema(description = "会话密钥ID", example = "session_key_001")
    private String keyId;

    /**
     * 加密算法
     */
    @Schema(description = "加密算法", example = "AES-GCM")
    private String algorithm;

    /**
     * 内容类型
     */
    @Schema(description = "内容类型", example = "text")
    private String contentType;

    /**
     * 消息大小（字节）
     */
    @Schema(description = "消息大小", example = "1024")
    private Integer messageSize;

    /**
     * 是否已签名
     */
    @Schema(description = "是否已签名", example = "true")
    private Boolean isSigned = false;

    /**
     * 验证状态
     */
    @Schema(description = "验证状态", example = "VERIFIED")
    private String verificationStatus;

    /**
     * 创建时间
     */
    @Schema(description = "创建时间")
    private LocalDateTime createTime;

    /**
     * 阅读时间
     */
    @Schema(description = "阅读时间")
    private LocalDateTime readAt;

    /**
     * 销毁时间
     */
    @Schema(description = "销毁时间")
    private LocalDateTime destructAt;

    /**
     * 自毁定时器（毫秒）
     */
    @Schema(description = "自毁定时器", example = "300000")
    private Long selfDestructTimer;

    /**
     * 是否已销毁
     */
    @Schema(description = "是否已销毁", example = "false")
    private Boolean isDestroyed = false;

    /**
     * 是否是群消息
     */
    @Schema(description = "是否是群消息", example = "false")
    private Boolean groupMessage;

    /**
     * 是否是私聊消息
     */
    @Schema(description = "是否是私聊消息", example = "true")
    private Boolean privateMessage;

    /**
     * 设置消息类型标识
     */
    public void setMessageTypeFlags() {
        this.groupMessage = roomId != null && roomId > 0;
        this.privateMessage = recipientId != null && recipientId > 0;
    }
}