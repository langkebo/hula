package com.luohuo.flex.model.enumeration;


/**
 * 是否
 *
 * @author tangyh
 * @date 2021/4/16 11:26 上午
 */
public enum StateEnum {
    /**
     * 启用
     */
    ENABLE(true, 1, "1", "启用"),
    /**
     * 禁用
     */
    DISABLE(false, 0, "0", "禁用"),
    ;
    private final Boolean bool;
    private final int integer;
    private final String str;
    private final String describe;

    private StateEnum(Boolean bool, int integer, String str, String describe) {
        this.bool = bool;
        this.integer = integer;
        this.str = str;
        this.describe = describe;
    }

    public static StateEnum match(String val, StateEnum... defs) {
        StateEnum def = defs.length > 0 ? defs[0] : DISABLE;
        if (val == null) {
            return def;
        }

        for (StateEnum value : StateEnum.values()) {
            if (value.getStr().equals(val)) {
                return value;
            }
        }
        return def;
    }

    public boolean eq(Integer val) {
        if (val == null) {
            return DISABLE.getBool();
        }
        return val.equals(this.getInteger());
    }

    public boolean eq(String val) {
        if (val == null) {
            return DISABLE.getBool();
        }
        return val.equals(this.getStr());
    }

    public boolean eq(Boolean val) {
        if (val == null) {
            return DISABLE.getBool();
        }
        return val.equals(this.getBool());
    }

    public Boolean getBool() { return bool; }
    public int getInteger() { return integer; }
    public String getStr() { return str; }
    public String getDescribe() { return describe; }
}
