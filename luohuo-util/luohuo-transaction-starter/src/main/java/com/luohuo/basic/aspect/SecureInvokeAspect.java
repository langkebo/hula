package com.luohuo.basic.aspect;

import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import com.luohuo.basic.annotation.SecureInvoke;
import com.luohuo.basic.domain.dto.SecureInvokeDTO;
import com.luohuo.basic.domain.entity.SecureInvokeRecord;
import com.luohuo.basic.jackson.JsonUtil;
import com.luohuo.basic.service.SecureInvokeHolder;
import com.luohuo.basic.service.SecureInvokeService;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Description: 安全执行切面
 * Date: 2023-04-20
 */
@Aspect
@Order(Ordered.HIGHEST_PRECEDENCE + 1)//确保最先执行
@Component
public class SecureInvokeAspect {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SecureInvokeAspect.class);
    @Autowired
    private SecureInvokeService secureInvokeService;

    @Around("@annotation(secureInvoke)")
    public Object around(ProceedingJoinPoint joinPoint, SecureInvoke secureInvoke) throws Throwable {
        boolean async = secureInvoke.async();
        boolean inTransaction = TransactionSynchronizationManager.isActualTransactionActive();
        //非事务状态，直接执行，不做任何保证。
        if (SecureInvokeHolder.isInvoking() || !inTransaction) {
            return joinPoint.proceed();
        }
        Method method = ((MethodSignature) joinPoint.getSignature()).getMethod();
        List<String> parameters = Stream.of(method.getParameterTypes()).map(Class::getName).collect(Collectors.toList());
        SecureInvokeDTO dto = new SecureInvokeDTO(
                method.getDeclaringClass().getName(),
                method.getName(),
                JsonUtil.toJson(parameters),
                JsonUtil.toJson(joinPoint.getArgs())
        );

		// offsetMinute
        SecureInvokeRecord record = new SecureInvokeRecord();
        record.setSecureInvokeDTO(dto);
        record.setMaxRetryTimes(secureInvoke.maxRetryTimes());
        record.setNextRetryTime(LocalDateTime.now().plusMinutes((int) SecureInvokeService.RETRY_INTERVAL_MINUTES));
        secureInvokeService.invoke(record, async);
        return null;
    }

}
