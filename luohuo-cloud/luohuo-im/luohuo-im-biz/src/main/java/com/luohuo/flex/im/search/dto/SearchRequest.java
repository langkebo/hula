package com.luohuo.flex.im.search.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import java.util.Date;
import java.util.List;

/**
 * 搜索请求DTO
 *
 * @author HuLa
 */
@Data
@Accessors(chain = true)
public class SearchRequest {

    /**
     * 搜索关键词
     */
    @NotBlank(message = "搜索关键词不能为空")
    private String keyword;

    /**
     * 搜索类型
     */
    private SearchType type = SearchType.ALL;

    /**
     * 用户ID（搜索指定用户的消息）
     */
    private Long userId;

    /**
     * 会话ID（搜索指定会话的消息）
     */
    private Long conversationId;

    /**
     * 消息类型过滤
     */
    private List<String> messageTypes;

    /**
     * 开始时间
     */
    private Date startTime;

    /**
     * 结束时间
     */
    private Date endTime;

    /**
     * 发送者ID过滤
     */
    private Long senderId;

    /**
     * 是否包含附件
     */
    private Boolean hasAttachment;

    /**
     * 附件类型过滤
     */
    private List<String> attachmentTypes;

    /**
     * 标签过滤
     */
    private List<String> tags;

    /**
     * 地理位置范围搜索
     */
    private GeoSearch geoSearch;

    /**
     * 排序字段
     */
    private String sortBy = "createdAt";

    /**
     * 排序方向
     */
    private SortDirection sortDirection = SortDirection.DESC;

    /**
     * 页码（从0开始）
     */
    @Min(value = 0, message = "页码不能小于0")
    private Integer page = 0;

    /**
     * 每页大小
     */
    @Min(value = 1, message = "每页大小不能小于1")
    @Max(value = 100, message = "每页大小不能超过100")
    private Integer size = 20;

    /**
     * 是否高亮关键词
     */
    private Boolean highlight = true;

    /**
     * 是否包含摘要
     */
    private Boolean includeSnippet = true;

    /**
     * 搜索类型枚举
     */
    public enum SearchType {
        ALL,           // 搜索所有内容
        MESSAGE,       // 只搜索消息内容
        USER,          // 搜索用户
        CONVERSATION,  // 搜索会话
        FILE,          // 搜索文件
        IMAGE,         // 搜索图片
        VIDEO          // 搜索视频
    }

    /**
     * 排序方向枚举
     */
    public enum SortDirection {
        ASC,   // 升序
        DESC   // 降序
    }

    /**
     * 地理位置搜索
     */
    @Data
    public static class GeoSearch {
        /**
         * 纬度
         */
        private Double lat;

        /**
         * 经度
         */
        private Double lon;

        /**
         * 搜索半径（公里）
         */
        private Double radius = 10.0;

        /**
         * 单位
         */
        private String unit = "km";
    }

    /**
     * 获取偏移量
     */
    public Integer getOffset() {
        return page * size;
    }

    /**
     * 构建时间范围搜索
     */
    public boolean hasTimeRange() {
        return startTime != null || endTime != null;
    }

    /**
     * 构建消息类型过滤
     */
    public boolean hasMessageTypeFilter() {
        return messageTypes != null && !messageTypes.isEmpty();
    }

    /**
     * 构建附件类型过滤
     */
    public boolean hasAttachmentTypeFilter() {
        return attachmentTypes != null && !attachmentTypes.isEmpty();
    }

    /**
     * 构建标签过滤
     */
    public boolean hasTagFilter() {
        return tags != null && !tags.isEmpty();
    }

    /**
     * 构建地理位置搜索
     */
    public boolean hasGeoSearch() {
        return geoSearch != null && geoSearch.getLat() != null && geoSearch.getLon() != null;
    }
}
