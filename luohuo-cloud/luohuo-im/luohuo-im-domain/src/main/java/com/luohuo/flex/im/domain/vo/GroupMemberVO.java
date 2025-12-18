package com.luohuo.flex.im.domain.vo;

import lombok.Data;

import java.io.Serializable;

/**
 * 群组成员VO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
public class GroupMemberVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 成员ID
     */
    private Long memberId;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 群组ID
     */
    private Long groupId;

    /**
     * 用户昵称
     */
    private String userNickName;

    /**
     * 用户头像
     */
    private String userAvatar;

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
    private String joinTime;

    /**
     * 最后活跃时间
     */
    private String lastActiveTime;
}