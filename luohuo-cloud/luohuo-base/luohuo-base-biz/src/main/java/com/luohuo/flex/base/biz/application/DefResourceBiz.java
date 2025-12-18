package com.luohuo.flex.base.biz.application;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.luohuo.flex.base.service.application.DefResourceService;

import java.util.List;

/**
 * @author 乾乾
 * @date 2021/11/17 15:23
 */
@Service
@Slf4j
public class DefResourceBiz {
    private final DefResourceService defResourceService;

    @Autowired
    public DefResourceBiz(DefResourceService defResourceService) {
        this.defResourceService = defResourceService;
    }

    @Transactional(rollbackFor = Exception.class)
    public boolean removeByIdWithCache(List<Long> ids) {
        boolean result = defResourceService.removeByIdWithCache(ids);

        // 删除 角色资源关系表 员工资源关系表
        defResourceService.deleteRoleResourceRelByResourceId(ids);
        return result;
    }


}
