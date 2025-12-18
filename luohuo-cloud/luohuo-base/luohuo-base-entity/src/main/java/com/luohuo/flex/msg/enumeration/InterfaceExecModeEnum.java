package com.luohuo.flex.msg.enumeration;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import com.luohuo.basic.interfaces.BaseEnum;

import java.util.stream.Stream;

/**
 * [01-实现类 02-脚本]
 *
 * @author 乾乾
 * @date 2022/7/10 0010 15:00
 */
@Getter
@Schema(description = "接口执行模式-枚举")
public enum InterfaceExecModeEnum implements BaseEnum {
    /**
     * 实现类
     */
    IMPL_CLASS("01", "实现类"),
    /**
     * 脚本
     */
    SCRIPT("02", "脚本"),
    ;

    private final String value;
    private final String desc;

    InterfaceExecModeEnum(String value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    /**
     * 根据当前枚举的name匹配
     */
    public static InterfaceExecModeEnum match(String val, InterfaceExecModeEnum def) {
        return Stream.of(values()).parallel().filter(item -> item.name().equalsIgnoreCase(val)).findAny().orElse(def);
    }

    @Override
    public String getDesc() {
        return desc;
    }

    public static InterfaceExecModeEnum get(String val) {
        return match(val, null);
    }

    public boolean eq(InterfaceExecModeEnum val) {
        return val != null && eq(val.name());
    }

    @Override
    @Schema(description = "编码", allowableValues = "IMPL_CLASS,SCRIPT", example = "IMPL_CLASS")
    public String getCode() {
        return this.name();
    }

    @Override
    public String getValue() {
        return value;
    }
}