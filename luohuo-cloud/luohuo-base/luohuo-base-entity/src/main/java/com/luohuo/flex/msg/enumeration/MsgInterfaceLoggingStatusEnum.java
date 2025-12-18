package com.luohuo.flex.msg.enumeration;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import com.luohuo.basic.interfaces.BaseEnum;

import java.util.stream.Stream;

/**
 * @author 乾乾
 * @date 2022/7/10 0010 15:52
 */
@Getter
@Schema(description = "执行日志状态-枚举")
public enum MsgInterfaceLoggingStatusEnum implements BaseEnum {
    /**
     * 初始化
     */
    INIT("01", "初始化"),
    /**
     * 成功
     */
    SUCCESS("02", "成功"),
    /**
     * 失败
     */
    FAIL("03", "失败"),
    ;

    private final String value;
    private final String desc;

    MsgInterfaceLoggingStatusEnum(String value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    /**
     * 根据当前枚举的name匹配
     */
    public static MsgInterfaceLoggingStatusEnum match(String val, MsgInterfaceLoggingStatusEnum def) {
        return Stream.of(values()).parallel().filter(item -> item.name().equalsIgnoreCase(val)).findAny().orElse(def);
    }

    public static MsgInterfaceLoggingStatusEnum get(String val) {
        return match(val, null);
    }

    public boolean eq(MsgInterfaceLoggingStatusEnum val) {
        return val != null && eq(val.name());
    }

    @Override
    public String getDesc() {
        return desc;
    }

    @Override
    @Schema(description = "name", allowableValues = "INIT,SUCCESS,FAIL", example = "INIT")
    public String getCode() {
        return this.name();
    }

    @Override
    @Schema(description = "数据库中存储的值")
    public String getValue() {
        return this.value;
    }
}