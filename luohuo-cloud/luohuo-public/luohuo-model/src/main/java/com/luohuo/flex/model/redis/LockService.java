package com.luohuo.flex.model.redis;

import jakarta.annotation.Resource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.redisson.api.RLock;
import org.redisson.api.RedissonClient;
import org.springframework.stereotype.Service;
import com.luohuo.basic.exception.BizException;

import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/**
 * @author nyh
 */
@Service
public class LockService {
    private static final Logger log = LoggerFactory.getLogger(LockService.class);

    @Resource
    private RedissonClient redissonClient;

    public <T> T executeWithLockThrows(String key, int waitTime, TimeUnit unit, SupplierThrow<T> supplier) throws Throwable {
        RLock lock = redissonClient.getLock(key);
        boolean lockSuccess = lock.tryLock(waitTime, unit);
        if (!lockSuccess) {
            throw new BizException("分布式锁占用");
        }
        try {
            //执行锁内的代码逻辑
            return supplier.get();
        } finally {
            if (lock.isLocked() && lock.isHeldByCurrentThread()) {
                lock.unlock();
            }
        }
    }

    public <T> T executeWithLock(String key, int waitTime, TimeUnit unit, Supplier<T> supplier) {
        try {
            return executeWithLockThrows(key, waitTime, unit, supplier::get);
        } catch (Throwable e) {
            throw new RuntimeException(e);
        }
    }

    public <T> T executeWithLock(String key, Supplier<T> supplier) {
        return executeWithLock(key, -1, TimeUnit.MILLISECONDS, supplier);
    }

    @FunctionalInterface
    public interface SupplierThrow<T> {

        /**
         * Gets a result.
         *
         * @return a result
         */
        T get() throws Throwable;
    }
}
