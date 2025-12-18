package com.luohuo.flex.datascope.model;

import cn.hutool.core.util.StrUtil;
import com.luohuo.basic.utils.ArgumentAssert;

import java.util.Collections;
import java.util.List;

/**
 * @author 乾乾
 * @date 2022/1/9 21:19
 */
public class DataFieldProperty {
    public static final List<DataFieldProperty> EMPTY_INSTANCE = Collections.emptyList();
    String alias;

    String field;

    private List<Long> values;

    public DataFieldProperty() {}
    public DataFieldProperty(String alias) { this.alias = alias; }

    public String getAliasDotField() {
        ArgumentAssert.notEmpty(this.field, "请为数据权限配置待过滤数据的字段名");
        return StrUtil.isEmpty(alias) ? this.field : this.alias + "." + this.field;
    }

    public String getAlias() { return alias; }
    public void setAlias(String alias) { this.alias = alias; }
    public String getField() { return field; }
    public void setField(String field) { this.field = field; }
    public List<Long> getValues() { return values; }
    public void setValues(List<Long> values) { this.values = values; }
}
