package com.luohuo.flex.im.config;

import com.luohuo.flex.im.monitor.interceptor.PerformanceInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Web MVC配置
 *
 * @author HuLa
 */
@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final PerformanceInterceptor performanceInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // 注册性能监控拦截器
        registry.addInterceptor(performanceInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                    "/actuator/**",
                    "/health/**",
                    "/metrics/**",
                    "/swagger-ui/**",
                    "/v2/api-docs/**"
                );
    }
}