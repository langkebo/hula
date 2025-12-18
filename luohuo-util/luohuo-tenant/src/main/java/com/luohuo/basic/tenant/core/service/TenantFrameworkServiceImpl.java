package com.luohuo.basic.tenant.core.service;

import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.luohuo.basic.base.R;
import com.luohuo.basic.tenant.TenantCommonApi;

import java.time.Duration;
import java.util.List;

import static com.luohuo.basic.utils.CacheUtils.buildAsyncReloadingCache;


/**
 * Tenant 框架 Service 实现类
 */
public class TenantFrameworkServiceImpl implements TenantFrameworkService {

    private final TenantCommonApi tenantApi;

    public TenantFrameworkServiceImpl(TenantCommonApi tenantApi) {
        this.tenantApi = tenantApi;
    }

    /**
     * 针对 {@link #getTenantIds()} 的缓存
     */
    private final LoadingCache<Object, List<Long>> getTenantIdsCache = buildAsyncReloadingCache(
            Duration.ofMinutes(1L), // 过期时间 1 分钟
            new CacheLoader<>() {
                @Override
                public List<Long> load(Object key) {
                    return tenantApi.getTenantIdList().getData();
                }

            });

    /**
     * 针对 {@link #validTenant(Long)} 的缓存
     */
    private final LoadingCache<Long, R<Boolean>> validTenantCache = buildAsyncReloadingCache(
            Duration.ofMinutes(1L), // 过期时间 1 分钟
            new CacheLoader<Long, R<Boolean>>() {

                @Override
                public R<Boolean> load(Long id) {
                    return tenantApi.validTenant(id);
                }

            });

    @Override
    public List<Long> getTenantIds() {
        try {
            return getTenantIdsCache.get(Boolean.TRUE);
        } catch (java.util.concurrent.ExecutionException e) {
            return tenantApi.getTenantIdList().getData();
        }
    }

    @Override
    public void validTenant(Long id) {
        try {
            validTenantCache.get(id).getsuccess();
        } catch (java.util.concurrent.ExecutionException e) {
            tenantApi.validTenant(id);
        }
    }

}
