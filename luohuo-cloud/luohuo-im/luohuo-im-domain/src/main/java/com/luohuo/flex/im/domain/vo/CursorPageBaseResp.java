package com.luohuo.flex.im.domain.vo;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.util.List;

/**
 * 游标分页响应基类
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Schema(description = "游标分页响应")
public class CursorPageBaseResp<T> {

    /**
     * 数据列表
     */
    @Schema(description = "数据列表")
    private List<T> list;

    /**
     * 是否为空
     */
    @Schema(description = "是否为空", example = "false")
    private Boolean empty;

    /**
     * 游标（用于下一页查询）
     */
    @Schema(description = "游标", example = "123456")
    private Long cursor;

    /**
     * 是否有更多数据
     */
    @Schema(description = "是否有更多数据", example = "true")
    private Boolean hasMore;

    /**
     * 数据总量（可选）
     */
    @Schema(description = "数据总量", example = "100")
    private Long total;

    /**
     * 当前页码
     */
    @Schema(description = "当前页码", example = "1")
    private Integer current;

    /**
     * 每页大小
     */
    @Schema(description = "每页大小", example = "20")
    private Integer size;
}