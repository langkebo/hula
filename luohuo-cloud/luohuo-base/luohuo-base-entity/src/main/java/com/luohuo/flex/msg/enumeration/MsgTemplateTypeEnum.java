package com.luohuo.flex.msg.enumeration;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import com.luohuo.basic.interfaces.BaseEnum;

import java.util.stream.Stream;

/**
 * <p>
 * 实体注释中生成的类型枚举
 * 消息表
 * </p>
 *
 * @author 乾乾
 * @date 2021-11-15
 */
@Getter
@Schema(description = "消息类型-枚举")
public enum MsgTemplateTypeEnum implements BaseEnum {

    /**
     * SMS="短信"
     */
    SMS("01", "短信"),
    /**
     * MAIL="邮件"
     */
    MAIL("02", "邮件"),
    /**
     * NOTICE="站内信"
     */
    NOTICE("03", "站内信"),
    ;

    private final String value;
    @Schema(description = "描述")
    private final String desc;

    MsgTemplateTypeEnum(String value, String desc) {
        this.value = value;
        this.desc = desc;
    }

    /**
     * 根据当前枚举的name匹配
     */
    public static MsgTemplateTypeEnum match(String val, MsgTemplateTypeEnum def) {
        return Stream.of(values()).parallel().filter(item -> item.name().equalsIgnoreCase(val)).findAny().orElse(def);
    }

    public static MsgTemplateTypeEnum get(String val) {
        return match(val, null);
    }

    public boolean eq(MsgTemplateTypeEnum val) {
        return val != null && eq(val.name());
    }

    @Override
    public String getDesc() {
        return desc;
    }

    @Override
    @Schema(description = "编码", allowableValues = "SMS,MAIL,NOTICE", example = "SMS")
    public String getCode() {
        return this.name();
    }

    @Override
    @Schema(description = "数据库中存储的值")
    public String getValue() {
        return this.value;
    }
}