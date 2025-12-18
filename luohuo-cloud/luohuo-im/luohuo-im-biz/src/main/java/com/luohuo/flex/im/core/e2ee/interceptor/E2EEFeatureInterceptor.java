package com.luohuo.flex.im.core.e2ee.interceptor;

import com.luohuo.basic.context.ContextUtil;
import com.luohuo.basic.exception.BizException;
import com.luohuo.flex.im.core.e2ee.service.E2EEFeatureToggle;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * E2EE功能拦截器
 *
 * 功能：
 * 1. 检查用户是否启用E2EE功能
 * 2. 拦截未授权的E2EE API访问
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class E2EEFeatureInterceptor implements HandlerInterceptor {

    private final E2EEFeatureToggle featureToggle;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 获取当前用户ID
        Long userId = ContextUtil.getUserId();
        if (userId == null) {
            // 未登录用户，放行到后续的认证拦截器处理
            return true;
        }

        // 检查用户是否启用E2EE功能
        if (!featureToggle.isE2EEEnabledForUser(userId)) {
            log.warn("用户 {} 尝试访问E2EE接口但功能未启用", userId);
            throw new BizException("E2EE功能未启用，请联系管理员");
        }

        // 用户已启用E2EE功能，放行
        return true;
    }
}
