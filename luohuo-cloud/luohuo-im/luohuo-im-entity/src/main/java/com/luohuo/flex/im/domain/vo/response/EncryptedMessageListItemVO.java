package com.luohuo.flex.im.domain.vo.response;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 加密消息列表项VO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Schema(description = "加密消息列表项")
public class EncryptedMessageListItemVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 消息ID
     */
    @Schema(description = "消息ID")
    private Long id;

    /**
     * 会话ID
     */
    @Schema(description = "会话ID")
    private String conversationId;

    /**
     * 发送者ID
     */
    @Schema(description = "发送者ID")
    private Long senderId;

    /**
     * 发送者昵称
     */
    @Schema(description = "发送者昵称")
    private String senderName;

    /**
     * 发送者头像
     */
    @Schema(description = "发送者头像")
    private String senderAvatar;

    /**
     * 接收者ID（单聊）
     */
    @Schema(description = "接收者ID")
    private Long recipientId;

    /**
     * 群组ID（群聊）
     */
    @Schema(description = "群组ID")
    private Long groupId;

    /**
     * 群组名称
     */
    @Schema(description = "群组名称")
    private String groupName;

    /**
     * 消息类型提示
     */
    @Schema(description = "消息类型提示")
    private String messageType;

    /**
     * 消息状态
     */
    @Schema(description = "消息状态")
    private Integer status;

    /**
     * 是否加密
     */
    @Schema(description = "是否加密")
    private Boolean encrypted;

    /**
     * 创建时间
     */
    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

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
     * 消息方向（发送/接收）
     */
    @Schema(description = "消息方向")
    private Integer direction;

    /**
     * 是否已读
     */
    @Schema(description = "是否已读")
    private Boolean isRead;

    /**
     * 缩略内容（可选，用于列表展示）
     */
    @Schema(description = "缩略内容")
    private String preview;

    // E2EE 加密相关字段
    @Schema(description = "房间ID")
    private Long roomId;

    @Schema(description = "密钥ID")
    private String keyId;

    @Schema(description = "加密算法")
    private String algorithm;

    @Schema(description = "内容类型")
    private String contentType;

    @Schema(description = "消息大小")
    private Integer messageSize;

    @Schema(description = "是否签名")
    private Boolean isSigned;

    @Schema(description = "验证状态")
    private String verificationStatus;

    @Schema(description = "自毁定时器")
    private Long selfDestructTimer;

    @Schema(description = "是否已销毁")
    private Boolean isDestroyed;

    @Schema(description = "消息类型标记")
    private String messageTypeFlags;

    @Schema(description = "创建时间")
    private LocalDateTime createTime;

    @Schema(description = "消息状态")
    private Integer msgStatus;
}