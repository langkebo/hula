package com.luohuo.flex.model.util;

import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;

/**
 * 上下文工具类
 */
public class ContextUtil {

    /**
     * 获取当前用户ID
     */
    public static Long getCurrentUserId() {
        // 从Token中获取用户ID
        // 这里需要根据实际的Token解析逻辑实现
        return 1L; // 临时返回
    }

    /**
     * 获取当前租户ID
     */
    public static Long getCurrentTenantId() {
        // 从Token中获取租户ID
        return 1L; // 临时返回
    }

    /**
     * 获取当前请求
     */
    public static HttpServletRequest getCurrentRequest() {
        return ((ServletRequestAttributes) RequestContextHolder.getRequestAttributes()).getRequest();
    }

    /**
     * 获取客户端IP
     */
    public static String getClientIP() {
        HttpServletRequest request = getCurrentRequest();
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        return ip;
    }
}
