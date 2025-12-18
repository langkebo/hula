package com.luohuo.basic.echo.manager;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.luohuo.basic.annotation.echo.Echo;

import java.io.Serializable;

/**
 * 封装字段上标记了 Echo 注解的字段
 *
 * @author 乾乾
 * @date 2020/5/8 下午9:19
 */
public class FieldParam {
    /**
     * 当前字段上的注解
     */
    private Echo echo;
    /**
     * 从当前字段的值构造出的调用api#method方法的参数
     */
    private Serializable actualValue;
    /**
     * 当前字段的具体值
     */
    private Object originalValue;

    /**
     * 当前 字段名
     */
    private String fieldName;

    private LoadKey loadKey;

    public FieldParam() {}
    public FieldParam(Echo echo, Serializable actualValue, Object originalValue, String fieldName, LoadKey loadKey) {
        this.echo = echo;
        this.actualValue = actualValue;
        this.originalValue = originalValue;
        this.fieldName = fieldName;
        this.loadKey = loadKey;
    }
    public Echo getEcho() { return echo; }
    public void setEcho(Echo echo) { this.echo = echo; }
    public Serializable getActualValue() { return actualValue; }
    public void setActualValue(Serializable actualValue) { this.actualValue = actualValue; }
    public Object getOriginalValue() { return originalValue; }
    public void setOriginalValue(Object originalValue) { this.originalValue = originalValue; }
    public String getFieldName() { return fieldName; }
    public void setFieldName(String fieldName) { this.fieldName = fieldName; }
    public LoadKey getLoadKey() { return loadKey; }
    public void setLoadKey(LoadKey loadKey) { this.loadKey = loadKey; }
}
