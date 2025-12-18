package com.luohuo.flex.satoken.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import com.luohuo.flex.common.properties.SystemProperties;
import com.luohuo.flex.satoken.interceptor.HeaderThreadLocalInterceptor;
import com.luohuo.flex.satoken.interceptor.NotAllowWriteInterceptor;

/**
 * 公共配置类, 一些公共工具配置
 *
 * @author 乾乾
 * @date 2018/8/25
 */
public class GlobalMvcConfigurer implements WebMvcConfigurer {
    private final SystemProperties systemProperties;
    private static final Logger log = LoggerFactory.getLogger(GlobalMvcConfigurer.class);

    public GlobalMvcConfigurer(SystemProperties systemProperties) {
        this.systemProperties = systemProperties;
    }

	@Override
	public void addInterceptors(InterceptorRegistry registry) {
		registry.addInterceptor(new HeaderThreadLocalInterceptor())
				.addPathPatterns("/**")
				.order(-20);
		registry.addInterceptor(new NotAllowWriteInterceptor(systemProperties))
				.addPathPatterns("/**")
				.order(Integer.MIN_VALUE);
	}
}
