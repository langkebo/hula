package com.luohuo.flex.im.domain.dto;

import lombok.Data;

import java.io.Serializable;
import java.util.List;

/**
 * 群组操作DTO
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
public class GroupOperationDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 群组ID
     */
    private Long groupId;

    /**
     * 操作类型（1-邀请入群，2-踢出群聊，3-退出群聊，4-修改群信息，5-转让群主）
     */
    private Integer operationType;

    /**
     * 操作者ID
     */
    private Long operatorId;

    /**
     * 被操作者ID列表（用于批量操作）
     */
    private List<Long> targetUserIds;

    /**
     * 群组名称（修改群信息时使用）
     */
    private String groupName;

    /**
     * 群组头像（修改群信息时使用）
     */
    private String groupAvatar;

    /**
     * 群组描述（修改群信息时使用）
     */
    private String groupDesc;

    /**
     * 新群主ID（转让群主时使用）
     */
    private Long newOwnerId;

    /**
     * 操作原因
     */
    private String reason;

    /**
     * 操作时间
     */
    private Long operationTime;
}