package com.luohuo.flex.im.domain.dto;

import lombok.Data;

import java.io.Serializable;

/**
 * 群组成员DTO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
public class GroupMemberDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 群组ID
     */
    private Long groupId;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 成员角色（1-普通成员，2-管理员，3-群主）
     */
    private Integer memberRole;

    /**
     * 成员状态（1-正常，2-禁言，3-踢出）
     */
    private Integer memberStatus;

    /**
     * 加群时间
     */
    private Long joinTime;

    /**
     * 最后活跃时间
     */
    private Long lastActiveTime;
}