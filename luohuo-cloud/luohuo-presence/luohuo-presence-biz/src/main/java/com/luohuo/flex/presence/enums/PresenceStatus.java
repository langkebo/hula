package com.luohuo.flex.presence.enums;

import com.luohuo.basic.interfaces.BaseEnum;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.stream.Stream;

/**
 * 用户在线状态枚举
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Getter
@AllArgsConstructor
@Schema(description = "用户在线状态-枚举")
public enum PresenceStatus implements BaseEnum {

    /**
     * 在线
     */
    ONLINE(1, "在线"),

    /**
     * 离开
     */
    AWAY(2, "离开"),

    /**
     * 忙碌
     */
    BUSY(3, "忙碌"),

    /**
     * 隐身
     */
    INVISIBLE(4, "隐身"),

    /**
     * 离线
     */
    OFFLINE(5, "离线"),

    /**
     * 请勿打扰
     */
    DO_NOT_DISTURB(6, "请勿打扰");

    @Schema(description = "编码值")
    private final Integer code;

    @Schema(description = "描述")
    private final String desc;

    /**
     * 根据编码匹配
     */
    public static PresenceStatus match(Integer code, PresenceStatus def) {
        return Stream.of(values()).parallel()
                .filter(item -> item.code.equals(code))
                .findAny()
                .orElse(def);
    }

    /**
     * 根据编码获取
     */
    public static PresenceStatus get(Integer code) {
        return match(code, null);
    }

    /**
     * 根据名称匹配
     */
    public static PresenceStatus match(String name, PresenceStatus def) {
        return Stream.of(values()).parallel()
                .filter(item -> item.name().equalsIgnoreCase(name))
                .findAny()
                .orElse(def);
    }

    /**
     * 根据名称获取
     */
    public static PresenceStatus get(String name) {
        return match(name, null);
    }

    @Override
    public String getCode() {
        return code.toString();
    }

}