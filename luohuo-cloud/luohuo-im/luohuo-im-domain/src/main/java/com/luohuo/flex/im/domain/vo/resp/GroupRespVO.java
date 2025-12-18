package com.luohuo.flex.im.domain.vo.resp;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 群组响应VO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
public class GroupRespVO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 群组ID
     */
    private Long groupId;

    /**
     * 群组名称
     */
    private String groupName;

    /**
     * 群组头像
     */
    private String groupAvatar;

    /**
     * 群组描述
     */
    private String groupDesc;

    /**
     * 群主ID
     */
    private Long groupOwnerId;

    /**
     * 群主昵称
     */
    private String groupOwnerName;

    /**
     * 成员数量
     */
    private Integer memberCount;

    /**
     * 群组类型（1-普通群，2-企业群）
     */
    private Integer groupType;

    /**
     * 群组状态（1-正常，2-解散）
     */
    private Integer groupStatus;

    /**
     * 加群方式（1-自由加入，2-需要验证，3-禁止加入）
     */
    private Integer joinType;

    /**
     * 创建时间
     */
    private String createTime;

    /**
     * 更新时间
     */
    private String updateTime;

    /**
     * 群成员列表（可选）
     */
    private List<GroupMemberRespVO> members;
}