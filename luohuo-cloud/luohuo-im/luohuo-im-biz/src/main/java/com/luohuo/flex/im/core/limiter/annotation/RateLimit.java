package com.luohuo.flex.im.core.limiter.annotation;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 限流注解
 * 支持多种限流策略
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RateLimit {

    /**
     * 限流键表达式（使用 SpEL）
     * 例如：#args[0] 或 #user.id
     */
    String key() default "";

    /**
     * 时间窗口（毫秒）
     */
    long window() default 60000;

    /**
     * 限制数量
     */
    int limit() default 100;

    /**
     * 限流类型
     */
    RateLimitType type() default RateLimitType.SLIDING_WINDOW;

    /**
     * 限流器名称（用于统计和动态调整）
     */
    String limiterName() default "";

    /**
     * 是否预热限流器
     */
    boolean warmup() default false;

    /**
     * 预热时的初始令牌数
     */
    int initialTokens() default 0;

    /**
     * 桶容量（仅用于令牌桶）
     */
    int capacity() default -1;

    /**
     * 令牌生成速率（每秒，仅用于令牌桶）
     */
    int tokensPerSecond() default 10;

    /**
     * 错误消息
     */
    String message() default "请求过于频繁，请稍后再试";

    /**
     * 错误码
     */
    String errorCode() default "RATE_LIMIT_EXCEEDED";

    /**
     * 是否记录限流日志
     */
    boolean logHit() default true;

    enum RateLimitType {
        SLIDING_WINDOW,  // 滑动窗口
        TOKEN_BUCKET,     // 令牌桶
        FIXED_WINDOW      // 固定窗口
    }
}