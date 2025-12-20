package com.luohuo.flex.im.search.dto;

import lombok.Data;
import lombok.experimental.Accessors;

import java.util.List;

/**
 * 搜索响应DTO
 *
 * @author HuLa
 */
@Data
@Accessors(chain = true)
public class SearchResponse<T> {

    /**
     * 搜索结果列表
     */
    private List<T> results;

    /**
     * 总数
     */
    private Long total;

    /**
     * 当前页码
     */
    private Integer page;

    /**
     * 每页大小
     */
    private Integer size;

    /**
     * 总页数
     */
    private Integer totalPages;

    /**
     * 是否有下一页
     */
    private Boolean hasNext;

    /**
     * 是否有上一页
     */
    private Boolean hasPrevious;

    /**
     * 搜索耗时（毫秒）
     */
    private Long took;

    /**
     * 搜索建议
     */
    private List<String> suggestions;

    /**
     * 聚合结果
     */
    private Aggregations aggregations;

    /**
     * 构造函数
     */
    public SearchResponse() {}

    /**
     * 构造函数
     */
    public SearchResponse(List<T> results, Long total, Integer page, Integer size) {
        this.results = results;
        this.total = total;
        this.page = page;
        this.size = size;
        this.totalPages = (int) Math.ceil((double) total / size);
        this.hasNext = page < totalPages - 1;
        this.hasPrevious = page > 0;
    }

    /**
     * 聚合结果
     */
    @Data
    public static class Aggregations {
        /**
         * 按消息类型聚合
         */
        private List<TypeAggregation> typeAggregations;

        /**
         * 按时间聚合
         */
        private List<DateAggregation> dateAggregations;

        /**
         * 按发送者聚合
         */
        private List<UserAggregation> userAggregations;

        /**
         * 热门关键词
         */
        private List<KeywordAggregation> keywordAggregations;
    }

    /**
     * 类型聚合
     */
    @Data
    public static class TypeAggregation {
        private String type;
        private Long count;
    }

    /**
     * 日期聚合
     */
    @Data
    public static class DateAggregation {
        private String date;
        private Long count;
    }

    /**
     * 用户聚合
     */
    @Data
    public static class UserAggregation {
        private Long userId;
        private String username;
        private String avatar;
        private Long count;
    }

    /**
     * 关键词聚合
     */
    @Data
    public static class KeywordAggregation {
        private String keyword;
        private Long score;
    }
}