package com.luohuo.flex.im.monitor.interceptor;

import com.luohuo.flex.im.monitor.service.impl.PerformanceMonitorServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * 性能监控拦截器
 *
 * @author HuLa
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PerformanceInterceptor implements HandlerInterceptor {

    private final PerformanceMonitorServiceImpl performanceMonitorService;

    private static final String START_TIME_ATTR = "startTime";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        request.setAttribute(START_TIME_ATTR, System.currentTimeMillis());
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        try {
            Long startTime = (Long) request.getAttribute(START_TIME_ATTR);
            if (startTime != null) {
                long took = System.currentTimeMillis() - startTime;

                String apiPath = request.getRequestURI();
                String method = request.getMethod();
                int statusCode = response.getStatus();
                Long userId = getUserIdFromRequest(request);

                // 记录API性能指标
                performanceMonitorService.recordApiMetrics(apiPath, method, took, statusCode, userId);

                // 记录慢API日志
                if (took > 2000) {
                    log.warn("Slow API detected: {} {} took {}ms", method, apiPath, took);
                }

                // 记录错误API日志
                if (statusCode >= 500 || ex != null) {
                    log.error("API error: {} {} returned {} - {}", method, apiPath, statusCode, ex != null ? ex.getMessage() : "");
                }
            }
        } catch (Exception e) {
            log.error("Failed to record performance metrics", e);
        }
    }

    /**
     * 从请求中提取用户ID
     * 从JWT token或认证信息中提取用户ID
     */
    private Long getUserIdFromRequest(HttpServletRequest request) {
        // 1. 尝试从JWT token中提取
        String token = request.getHeader("Authorization");
        if (token != null && token.startsWith("Bearer ")) {
            try {
                // TODO: 实现JWT解析逻辑，提取用户ID
                // String jwt = token.substring(7);
                // return jwtParser.extractUserId(jwt);
            } catch (Exception e) {
                log.debug("Failed to parse JWT token", e);
            }
        }

        // 2. 尝试从请求属性中获取（已认证的用户）
        Object userId = request.getAttribute("userId");
        if (userId instanceof Long) {
            return (Long) userId;
        }

        // 3. 尝试从session中获取
        Object sessionUserId = request.getSession().getAttribute("userId");
        if (sessionUserId instanceof Long) {
            return (Long) sessionUserId;
        }

        return null;
    }
}
