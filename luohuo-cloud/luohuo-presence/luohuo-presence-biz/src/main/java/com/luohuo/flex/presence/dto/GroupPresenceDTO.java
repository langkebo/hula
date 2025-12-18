package com.luohuo.flex.presence.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 群组在线统计DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "群组在线统计DTO")
public class GroupPresenceDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    @Schema(description = "群组ID", example = "group_123")
    private String groupId;

    @Schema(description = "总人数", example = "100")
    private Integer totalCount;

    @Schema(description = "在线人数", example = "85")
    private Integer onlineCount;

    @Schema(description = "离开人数", example = "10")
    private Integer awayCount;

    @Schema(description = "忙碌人数", example = "3")
    private Integer busyCount;

    @Schema(description = "隐身人数", example = "2")
    private Integer invisibleCount;

    @Schema(description = "最后更新时间")
    private LocalDateTime lastUpdateTime;

    @Schema(description = "在线率（百分比）", example = "85.0")
    private Double onlineRate;

    /**
     * 计算在线率
     */
    public Double calculateOnlineRate() {
        if (totalCount == null || totalCount == 0) {
            return 0.0;
        }
        return (onlineCount.doubleValue() / totalCount) * 100;
    }

}