package com.luohuo.flex.im.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.experimental.Accessors;

import java.time.LocalDateTime;

/**
 * 搜索历史实体
 *
 * @author HuLa
 */
@Data
@EqualsAndHashCode(callSuper = false)
@Accessors(chain = true)
@TableName("im_search_history")
public class SearchHistory {

    /**
     * 主键
     */
    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 搜索关键词
     */
    private String keyword;

    /**
     * 搜索类型：all/group/private
     */
    private String searchType;

    /**
     * 搜索参数（JSON格式）
     */
    private String searchParams;

    /**
     * 搜索结果数
     */
    private Integer resultCount;

    /**
     * 搜索耗时（毫秒）
     */
    private Integer searchTime;

    /**
     * 搜索时间
     */
    private LocalDateTime searchedAt;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 租户ID
     */
    private Long tenantId;
}