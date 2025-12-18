package com.luohuo.flex.im.domain.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 好友DTO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
public class FriendDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 好友ID
     */
    private Long friendUserId;

    /**
     * 好友备注
     */
    private String friendRemark;

    /**
     * 好友分组
     */
    private String friendGroup;

    /**
     * 好友状态（1-正常，2-拉黑，3-删除）
     */
    private Integer friendStatus;

    /**
     * 添加时间
     */
    private Long addTime;

    /**
     * 最后互动时间
     */
    private Long lastInteractionTime;
}