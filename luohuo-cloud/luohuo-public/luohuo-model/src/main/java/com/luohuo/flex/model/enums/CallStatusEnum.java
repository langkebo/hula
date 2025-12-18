package com.luohuo.flex.model.enums;


import java.util.Arrays;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 通话状态机
 * @author 乾乾
 */
public enum CallStatusEnum {
	ONGOING("ONGOING", "通话进行中"),
	COMPLETED("COMPLETED", "通话正常结束"),
	REJECTED("REJECTED", "拒绝"),
	DROPPED("DROPPED", "挂断"),
	CANCEL("CANCEL", "取消"),
	TIMEOUT("TIMEOUT", "呼叫超时未接听"),
	FAILED("FAILED", "连接失败"),
	RINGING("RINGING", "对方响铃中"),
	MANAGER_CLOSE("MANAGER_CLOSE", "管理员关闭"),
    ;

    private final String status;
    private final String desc;

    private CallStatusEnum(String status, String desc) {
        this.status = status;
        this.desc = desc;
    }

    private static Map<String, CallStatusEnum> cache;

    static {
        cache = Arrays.stream(CallStatusEnum.values()).collect(Collectors.toMap(CallStatusEnum::getStatus, Function.identity()));
    }

    public static CallStatusEnum of(String type) {
        return cache.get(type);
    }

    public String getStatus() { return status; }
    public String getDesc() { return desc; }
}
