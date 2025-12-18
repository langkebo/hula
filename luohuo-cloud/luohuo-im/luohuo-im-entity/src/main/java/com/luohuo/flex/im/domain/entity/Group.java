package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 群组实体
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Data
@EqualsAndHashCode(callSuper = false)
@TableName("im_group")
public class Group implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 群组ID
     */
    @TableId
    private Long id;

    /**
     * 群组名称
     */
    private String name;

    /**
     * 群组描述
     */
    private String description;

    /**
     * 群主ID
     */
    private Long ownerId;

    /**
     * 群组头像
     */
    private String avatar;

    /**
     * 群组类型（1:普通群 2:企业群）
     */
    private Integer type;

    /**
     * 群组状态（1:正常 2:禁用）
     */
    private Integer status;

    /**
     * 成员数量
     */
    private Integer memberCount;

    /**
     * 创建时间
     */
    private LocalDateTime createdAt;

    /**
     * 更新时间
     */
    private LocalDateTime updatedAt;
}