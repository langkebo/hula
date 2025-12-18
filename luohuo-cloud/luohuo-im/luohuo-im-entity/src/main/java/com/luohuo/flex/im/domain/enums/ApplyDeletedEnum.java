package com.luohuo.flex.im.domain.enums;

import java.util.Arrays;
import java.util.List;

public enum ApplyDeletedEnum {

    NORMAL(0, "未删除"),
    APPLY_DELETED(1, "申请人删除"),
    TARGET_DELETED(2, "被申请人删除"),
    ALL_DELETED(3, "双方都删除了");

    private final Integer code;

    private final String desc;
    ApplyDeletedEnum(Integer code, String desc) {
        this.code = code;
        this.desc = desc;
    }
    public Integer getCode() {
        return code;
    }
    public String getDesc() {
        return desc;
    }

    /**
     * 申请方已经删除
     *
     * @return {@link List }<{@link Integer }>
     */
    public static List<Integer> applyDeleted() {
        return Arrays.asList(ALL_DELETED.getCode(), APPLY_DELETED.getCode());
    }

    public static List<Integer> targetDeleted() {
        return Arrays.asList(ALL_DELETED.getCode(), TARGET_DELETED.getCode());
    }}
