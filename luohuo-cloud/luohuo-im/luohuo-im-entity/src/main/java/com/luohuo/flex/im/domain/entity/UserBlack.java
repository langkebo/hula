package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 用户黑名单实体
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("user_black")
public class UserBlack implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 主键ID
     */
    @TableId
    private Long id;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 被拉黑的用户ID
     */
    private Long blackUserId;

    /**
     * 拉黑原因
     */
    private String reason;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;
}