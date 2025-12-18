package com.luohuo.flex.im.domain.enums;


import com.luohuo.basic.interfaces.BaseEnum;

/**
 * 物品枚举
 * @author nyh
 */
public enum BlackTypeEnum implements BaseEnum {
    IP(1),
    UID(2),
    ;

    private final Integer type;
    BlackTypeEnum(Integer type) {
        this.type = type;
    }
    public Integer getType() {
        return type;
    }

    @Override
    public String getCode() {
        return String.valueOf(type);
    }

    @Override
    public String getDesc() {
        return name();
    }
}
