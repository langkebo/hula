package com.luohuo.flex.datascope.provider;

import org.springframework.stereotype.Component;
import com.luohuo.basic.base.entity.SuperEntity;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.datascope.model.DataFieldProperty;

import java.util.Collections;
import java.util.List;

/**
 * 个人的数据
 *
 * @author 乾乾
 * @date 2022/1/9 23:29
 */
@Component("DATA_SCOPE_06")
public class SelfDataScopeProviderImpl implements DataScopeProvider {

    @Override
    public List<DataFieldProperty> findDataFieldProperty(List<DataFieldProperty> fsp) {
        List<Long> employeeIdList = Collections.singletonList(ContextUtil.getUserId());
        fsp.forEach(item -> {
            item.setField(SuperEntity.CREATE_BY_FIELD);
            item.setValues(employeeIdList);
        });
        return fsp;
    }
}
