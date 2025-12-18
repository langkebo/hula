package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.luohuo.basic.base.entity.TenantEntity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import com.luohuo.flex.im.domain.entity.msg.MessageExtra;

/**
 * <p>
 * 消息表
 * </p>
 *
 * @author nyh
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName(value = "im_message", autoResultMap = true)
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class Message extends TenantEntity<Long> {

    private static final long serialVersionUID = 1L;

    /**
     * 会话表id
     */
    @TableField("room_id")
    private Long roomId;

    /**
     * 消息发送者uid
     */
    @TableField("from_uid")
    private Long fromUid;

    /**
     * 消息内容
     */
    @TableField("content")
    private String content;

    /**
     * 回复的消息内容
     */
    @TableField("reply_msg_id")
    private Long replyMsgId;

    /**
     * 消息状态 0正常 1删除
     */
    @TableField("status")
    private Integer status;

    /**
     * 与回复消息的间隔条数
     */
    @TableField("gap_count")
    private Integer gapCount;

    /**
     * 消息类型 1正常文本 2.撤回消息
     */
    @TableField("type")
    private Integer type;

    /**
     * 消息扩展字段
     */
    @TableField(value = "extra", typeHandler = JacksonTypeHandler.class)
    private MessageExtra extra;

    /** 是否加密 */
    @TableField("is_encrypted")
    private Boolean isEncrypted;

    /** 关联的加密消息ID */
    @TableField("encrypted_msg_id")
    private Long encryptedMsgId;

    /**
     * 版本号（用于乐观锁，解决消息覆盖问题）
     * P1优化: 添加版本号字段支持乐观锁 (2025-12-13)
     */
    @com.baomidou.mybatisplus.annotation.Version
    @TableField("version")
    private Integer version;
}
