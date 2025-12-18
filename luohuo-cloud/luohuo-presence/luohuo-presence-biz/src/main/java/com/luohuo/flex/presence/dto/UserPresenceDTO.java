package com.luohuo.flex.presence.dto;

import com.luohuo.flex.presence.enums.PresenceStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * 用户在线状态DTO
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "用户在线状态DTO")
public class UserPresenceDTO implements Serializable {

    private static final long serialVersionUID = 1L;

    @Schema(description = "用户ID", example = "123456")
    private Long userId;

    @Schema(description = "状态", example = "ONLINE")
    private PresenceStatus status;

    @Schema(description = "最后活跃时间")
    private LocalDateTime lastActiveTime;

    @Schema(description = "设备信息（设备ID -> 设备信息）")
    private Map<String, DeviceInfo> devices;

    @Schema(description = "当前所在群组ID列表")
    private java.util.List<String> groupIds;

    @Schema(description = "自定义状态消息")
    private String customStatus;

    @Schema(description = "位置信息")
    private String location;

    /**
     * 设备信息内部类
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "设备信息")
    public static class DeviceInfo implements Serializable {

        private static final long serialVersionUID = 1L;

        @Schema(description = "设备ID")
        private String deviceId;

        @Schema(description = "平台类型", example = "web")
        private String platform;

        @Schema(description = "平台版本", example = "Chrome 120.0")
        private String platformVersion;

        @Schema(description = "客户端版本", example = "1.0.0")
        private String clientVersion;

        @Schema(description = "IP地址")
        private String ipAddress;

        @Schema(description = "地理位置")
        private String geoLocation;

        @Schema(description = "最后活跃时间")
        private LocalDateTime lastActiveTime;

    }

}