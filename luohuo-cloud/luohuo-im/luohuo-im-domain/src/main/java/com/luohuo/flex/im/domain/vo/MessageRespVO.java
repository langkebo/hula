package com.luohuo.flex.im.domain.vo;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 消息响应VO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
public class MessageRespVO implements Serializable {

    private static final long serialVersionUID = 1L;

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
     * 发送者昵称
     */
    private String senderName;

    /**
     * 发送者头像
     */
    private String senderAvatar;

    /**
     * 接收者ID（单聊时使用）
     */
    private Long receiverId;

    /**
     * 消息类型（1-文本，2-图片，3-语音，4-视频，5-文件，6-系统消息）
     */
    private Integer messageType;

    /**
     * 消息内容
     */
    private String content;

    /**
     * 消息URL（用于文件、图片、视频等）
     */
    private String url;

    /**
     * 文件大小（字节）
     */
    private Long fileSize;

    /**
     * 时长（秒，用于语音、视频）
     */
    private Integer duration;

    /**
     * 消息状态（1-发送中，2-发送成功，3-发送失败，4-已读）
     */
    private Integer messageStatus;

    /**
     * 是否加密（0-否，1-是）
     */
    private Integer isEncrypted;

    /**
     * 消息方向（1-发送，2-接收）
     */
    private Integer messageDirection;

    /**
     * 引用消息ID（回复消息时使用）
     */
    private Long quoteMessageId;

    /**
     * 引用消息内容
     */
    private String quoteContent;

    /**
     * @提及的用户ID列表
     */
    private List<Long> mentionUserIds;

    /**
     * 消息扩展信息（JSON格式）
     */
    private String extra;

    /**
     * 发送时间戳
     */
    private Long sendTime;

    /**
     * 创建时间
     */
    private String createTime;

    /**
     * 已读回执列表
     */
    private List<MessageReadReceipt> readReceipts;

    /**
     * 已读回执内部类
     */
    @Data
    public static class MessageReadReceipt implements Serializable {
        private static final long serialVersionUID = 1L;
        private Long userId;
        private String userName;
        private Long readTime;
    }
}