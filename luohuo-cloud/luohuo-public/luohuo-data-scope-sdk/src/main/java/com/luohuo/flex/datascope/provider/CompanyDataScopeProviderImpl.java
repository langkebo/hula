package com.luohuo.flex.datascope.provider;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import com.luohuo.basic.base.entity.SuperEntity;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.flex.datascope.model.DataFieldProperty;
import com.luohuo.flex.datascope.service.OrgHelperService;

import java.util.Collections;
import java.util.List;

/**
 * 本单位
 *
 * @author 乾乾
 * @date 2022/1/9 23:29
 */
@Component("DATA_SCOPE_03")
public class CompanyDataScopeProviderImpl implements DataScopeProvider {

    @Autowired
    private OrgHelperService orgHelperService;

    @Override
    public List<DataFieldProperty> findDataFieldProperty(List<DataFieldProperty> fsp) {
        Long mainCompanyId = orgHelperService.getMainCompanyIdByEmployeeId(ContextUtil.getUid());
        if (mainCompanyId == null) {
            return Collections.emptyList();
        }
        List<Long> employeeIdList = Collections.singletonList(mainCompanyId);
        fsp.forEach(item -> {
            item.setField(SuperEntity.CREATE_ORG_ID_FIELD);
            item.setValues(employeeIdList);
        });
        return fsp;
    }
}
