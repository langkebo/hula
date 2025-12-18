package com.luohuo.flex.im.core.e2ee.config;

import com.luohuo.flex.im.core.e2ee.interceptor.E2EEFeatureInterceptor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * E2EE Web配置
 *
 * 功能：
 * 1. 注册E2EE功能拦截器
 * 2. 配置拦截路径
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class E2EEWebConfig implements WebMvcConfigurer {

    private final E2EEFeatureInterceptor e2eeFeatureInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        log.info("注册E2EE功能拦截器");

        registry.addInterceptor(e2eeFeatureInterceptor)
                .addPathPatterns("/e2ee/**")
                .excludePathPatterns(
                        "/e2ee/health",           // 健康检查接口
                        "/e2ee/status",           // 状态查询接口
                        "/e2ee/admin/**"          // 管理接口（由Security控制）
                );
    }
}
