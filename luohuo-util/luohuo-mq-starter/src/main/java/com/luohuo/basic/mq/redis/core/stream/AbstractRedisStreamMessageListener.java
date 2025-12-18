package com.luohuo.basic.mq.redis.core.stream;

import cn.hutool.core.util.TypeUtil;
import lombok.Getter;
import lombok.Setter;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.stream.ObjectRecord;
import org.springframework.data.redis.stream.StreamListener;
import com.luohuo.basic.jackson.JsonUtil;
import com.luohuo.basic.mq.redis.core.RedisMQTemplate;
import com.luohuo.basic.mq.redis.core.interceptor.RedisMessageInterceptor;
import com.luohuo.basic.mq.redis.core.message.AbstractRedisMessage;

import java.lang.reflect.Type;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Redis Stream 监听器抽象类，用于实现集群消费
 * 
 * P4优化: 添加异常处理、日志记录和消费统计 (2025-12-16)
 *
 * @param <T> 消息类型。一定要填写噢，不然会报错
 *
 * @author 乾乾
 */
@Slf4j
public abstract class AbstractRedisStreamMessageListener<T extends AbstractRedisStreamMessage>
        implements StreamListener<String, ObjectRecord<String, String>> {

    /**
     * 消息类型
     */
    private final Class<T> messageType;
    /**
     * Redis Channel
     */
    private final String streamKey;

    /**
     * Redis 消费者分组，默认使用 spring.application.name 名字
     */
    @Value("${spring.application.name}")
    private String group;
    /**
     * RedisMQTemplate
     */
    private RedisMQTemplate redisMQTemplate;

    /**
     * 最大重试次数
     */
    @Value("${redis.stream.max-retry:3}")
    private int maxRetry = 3;

    /**
     * 消费统计
     */
    private final AtomicLong successCount = new AtomicLong(0);
    private final AtomicLong failureCount = new AtomicLong(0);

    protected AbstractRedisStreamMessageListener() {
        this.messageType = getMessageClass();
        try {
            this.streamKey = messageType.getDeclaredConstructor().newInstance().getStreamKey();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Override
    public void onMessage(ObjectRecord<String, String> message) {
        String messageId = message.getId().getValue();
        long startTime = System.currentTimeMillis();
        T messageObj = null;
        
        try {
            // 1. 解析消息
            messageObj = JsonUtil.parse(message.getValue(), messageType);
            
            // 2. 记录消费开始日志
            log.debug("[Redis Stream] 开始消费消息: streamKey={}, messageId={}, group={}", 
                    streamKey, messageId, group);
            
            // 3. 执行前置拦截器
            consumeMessageBefore(messageObj);
            
            // 4. 消费消息（带重试机制）
            consumeWithRetry(messageObj, messageId);
            
            // 5. ack 消息消费完成
            redisMQTemplate.getRedisTemplate().opsForStream().acknowledge(group, message);
            
            // 6. 更新成功统计
            successCount.incrementAndGet();
            
            // 7. 记录消费成功日志
            long duration = System.currentTimeMillis() - startTime;
            log.debug("[Redis Stream] 消息消费成功: streamKey={}, messageId={}, duration={}ms", 
                    streamKey, messageId, duration);
            
        } catch (Exception e) {
            // 更新失败统计
            failureCount.incrementAndGet();
            
            // 记录消费失败日志
            long duration = System.currentTimeMillis() - startTime;
            log.error("[Redis Stream] 消息消费失败: streamKey={}, messageId={}, duration={}ms, error={}", 
                    streamKey, messageId, duration, e.getMessage(), e);
            
            // 调用异常处理钩子（子类可覆盖）
            handleConsumeException(messageObj, message, e);
            
        } finally {
            // 执行后置拦截器
            if (messageObj != null) {
                consumeMessageAfter(messageObj);
            }
        }
    }

    /**
     * 带重试机制的消息消费
     * @param messageObj 消息对象
     * @param messageId 消息ID
     */
    private void consumeWithRetry(T messageObj, String messageId) {
        int retryCount = 0;
        Exception lastException = null;
        
        while (retryCount <= maxRetry) {
            try {
                this.onMessage(messageObj);
                return; // 消费成功，直接返回
            } catch (Exception e) {
                lastException = e;
                retryCount++;
                
                if (retryCount <= maxRetry) {
                    log.warn("[Redis Stream] 消息消费失败，准备重试: streamKey={}, messageId={}, retryCount={}/{}, error={}", 
                            streamKey, messageId, retryCount, maxRetry, e.getMessage());
                    
                    // 指数退避等待
                    try {
                        Thread.sleep((long) Math.pow(2, retryCount) * 100);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        throw new RuntimeException("消息消费重试被中断", ie);
                    }
                }
            }
        }
        
        // 重试次数用尽，抛出异常
        throw new RuntimeException("消息消费失败，已重试" + maxRetry + "次: " + lastException.getMessage(), lastException);
    }

    /**
     * 消费异常处理钩子
     * 子类可覆盖此方法实现自定义异常处理逻辑
     * 
     * @param messageObj 消息对象（可能为null）
     * @param record 原始消息记录
     * @param exception 异常
     */
    protected void handleConsumeException(T messageObj, ObjectRecord<String, String> record, Exception exception) {
        // 默认实现：仅记录日志
        // 子类可覆盖实现：发送告警、写入死信队列等
        log.error("[Redis Stream] 消息消费异常处理: streamKey={}, messageId={}", 
                streamKey, record.getId().getValue());
    }

    /**
     * 获取消费成功次数
     */
    public long getSuccessCount() {
        return successCount.get();
    }

    /**
     * 获取消费失败次数
     */
    public long getFailureCount() {
        return failureCount.get();
    }

    /**
     * 获取消费成功率
     */
    public double getSuccessRate() {
        long total = successCount.get() + failureCount.get();
        return total > 0 ? (double) successCount.get() / total * 100 : 100.0;
    }

    public String getStreamKey() { return streamKey; }
    public String getGroup() { return group; }
    public void setRedisMQTemplate(RedisMQTemplate redisMQTemplate) { this.redisMQTemplate = redisMQTemplate; }

    /**
     * 处理消息
     *
     * @param message 消息
     */
    public abstract void onMessage(T message);

    /**
     * 通过解析类上的泛型，获得消息类型
     *
     * @return 消息类型
     */
    @SuppressWarnings("unchecked")
    private Class<T> getMessageClass() {
        Type type = TypeUtil.getTypeArgument(getClass(), 0);
        if (type == null) {
            throw new IllegalStateException(String.format("类型(%s) 需要设置消息类型", getClass().getName()));
        }
        return (Class<T>) type;
    }

    private void consumeMessageBefore(AbstractRedisMessage message) {
        assert redisMQTemplate != null;
        List<RedisMessageInterceptor> interceptors = redisMQTemplate.getInterceptors();
        // 正序
        interceptors.forEach(interceptor -> interceptor.consumeMessageBefore(message));
    }

    private void consumeMessageAfter(AbstractRedisMessage message) {
        assert redisMQTemplate != null;
        List<RedisMessageInterceptor> interceptors = redisMQTemplate.getInterceptors();
        // 倒序
        for (int i = interceptors.size() - 1; i >= 0; i--) {
            interceptors.get(i).consumeMessageAfter(message);
        }
    }

}
