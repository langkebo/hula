package com.luohuo.flex.im.core.limiter.aspect;

import com.luohuo.flex.im.core.limiter.RateLimiterService;
import com.luohuo.flex.im.core.limiter.annotation.RateLimit;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.expression.EvaluationContext;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

/**
 * 限流切面
 * 基于注解的分布式限流实现
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class RateLimitAspect {

    private final RateLimiterService rateLimiterService;
    private final ExpressionParser expressionParser = new SpelExpressionParser();
    private final Map<String, Expression> expressionCache = new HashMap<>();

    @Around("@annotation(rateLimit)")
    public Object doRateLimit(ProceedingJoinPoint joinPoint, RateLimit rateLimit) throws Throwable {
        // 解析限流键
        String limitKey = parseRateLimitKey(joinPoint, rateLimit);

        // 如果没有指定key，使用默认策略
        if (limitKey == null || limitKey.isEmpty()) {
            limitKey = generateDefaultKey(joinPoint);
        }

        // 预热限流器
        if (rateLimit.warmup() && rateLimit.initialTokens() > 0) {
            rateLimiterService.warmupRateLimiter(limitKey, rateLimit.initialTokens());
        }

        // 执行限流检查
        boolean allowed = checkRateLimit(limitKey, rateLimit);

        if (!allowed) {
            // 记录限流日志
            if (rateLimit.logHit()) {
                log.warn("请求被限流拦截 - key: {}, window: {}ms, limit: {}, IP: {}",
                    limitKey, rateLimit.window(), rateLimit.limit(), getClientIP());
            }

            // 抛出限流异常
            throw new RateLimitExceededException(rateLimit.message(), rateLimit.errorCode());
        }

        // 继续执行原方法
        return joinPoint.proceed();
    }

    /**
     * 解析限流键
     */
    private String parseRateLimitKey(ProceedingJoinPoint joinPoint, RateLimit rateLimit) {
        String keyExpression = rateLimit.key();
        if (keyExpression == null || keyExpression.isEmpty()) {
            return null;
        }

        try {
            // 从缓存获取表达式
            Expression expression = expressionCache.computeIfAbsent(keyExpression, expr -> {
                return expressionParser.parseExpression(expr);
            });

            // 准备上下文
            EvaluationContext context = createEvaluationContext(joinPoint);

            // 解析表达式
            Object value = expression.getValue(context, String.class);
            return value != null ? value.toString() : null;
        } catch (Exception e) {
            log.error("解析限流键表达式失败: {}", keyExpression, e);
            return null;
        }
    }

    /**
     * 生成默认的限流键
     */
    private String generateDefaultKey(ProceedingJoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();

        // 生成方法级别的限流键
        String methodKey = method.getDeclaringClass().getSimpleName() + "." + method.getName();

        // 尝试从请求中获取用户ID或IP
        String userOrIp = getUserIdOrIP();

        if (userOrIp != null) {
            return methodKey + ":" + userOrIp;
        }

        return methodKey;
    }

    /**
     * 创建 SpEL 评估上下文
     */
    private EvaluationContext createEvaluationContext(ProceedingJoinPoint joinPoint) {
        // 这里可以使用 SpEL 的 StandardEvaluationContext
        // 为了简化，这里返回 null，实际使用时应该创建完整的上下文
        return null;
    }

    /**
     * 获取用户ID或IP
     */
    private String getUserIdOrIP() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();

                // 尝试获取用户ID（从请求头或参数）
                String userId = request.getHeader("X-User-Id");
                if (userId != null) {
                    return "user:" + userId;
                }

                // 获取IP地址
                String ip = getClientIP();
                return "ip:" + ip;
            }
        } catch (Exception e) {
            log.debug("获取用户ID或IP失败", e);
        }

        return null;
    }

    /**
     * 获取客户端IP
     */
    private String getClientIP() {
        try {
            ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attributes != null) {
                HttpServletRequest request = attributes.getRequest();
                String ip = request.getHeader("X-Forwarded-For");
                if (ip == null || ip.isEmpty()) {
                    ip = request.getHeader("X-Real-IP");
                }
                if (ip == null || ip.isEmpty()) {
                    ip = request.getRemoteAddr();
                }
                // 如果是多个IP，取第一个
                if (ip.contains(",")) {
                    ip = ip.split(",")[0].trim();
                }
                return ip;
            }
        } catch (Exception e) {
            log.debug("获取客户端IP失败", e);
        }
        return "unknown";
    }

    /**
     * 执行限流检查
     */
    private boolean checkRateLimit(String key, RateLimit rateLimit) {
        switch (rateLimit.type()) {
            case SLIDING_WINDOW:
                return rateLimiterService.isAllowedSlidingWindow(key, rateLimit.window(), rateLimit.limit());

            case TOKEN_BUCKET:
                int capacity = rateLimit.capacity() > 0 ? rateLimit.capacity() : rateLimit.limit();
                return rateLimiterService.isAllowedTokenBucket(key, capacity, rateLimit.tokensPerSecond());

            case FIXED_WINDOW:
                return rateLimiterService.isAllowedFixedWindow(key, (int) (rateLimit.window() / 1000), rateLimit.limit());

            default:
                return true;
        }
    }

    /**
     * 限流异常
     */
    public static class RateLimitExceededException extends RuntimeException {
        private final String errorCode;

        public RateLimitExceededException(String message, String errorCode) {
            super(message);
            this.errorCode = errorCode;
        }

        public String getErrorCode() {
            return errorCode;
        }
    }
}