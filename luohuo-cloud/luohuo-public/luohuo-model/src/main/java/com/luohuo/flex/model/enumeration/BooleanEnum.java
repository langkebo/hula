package com.luohuo.flex.model.enumeration;


/**
 * 是否
 *
 * @author tangyh
 * @date 2021/4/16 11:26 上午
 */
public enum BooleanEnum {
    /**
     * true
     */
    TRUE(true, 1, "1", "是"),
    /**
     * false
     */
    FALSE(false, 0, "0", "否"),
    ;
    private final Boolean bool;
    private final int integer;
    private final String str;
    private final String describe;

    private BooleanEnum(Boolean bool, int integer, String str, String describe) {
        this.bool = bool;
        this.integer = integer;
        this.str = str;
        this.describe = describe;
    }

    public boolean eq(Integer val) {
        if (val == null) {
            return FALSE.getBool();
        }
        return val.equals(this.getInteger());
    }

    public boolean eq(String val) {
        if (val == null) {
            return FALSE.getBool();
        }
        return val.equals(this.getStr());
    }

    public boolean eq(Boolean val) {
        if (val == null) {
            return FALSE.getBool();
        }
        return val.equals(this.getBool());
    }

    public Boolean getBool() { return bool; }
    public int getInteger() { return integer; }
    public String getStr() { return str; }
    public String getDescribe() { return describe; }
}
