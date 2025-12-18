package com.luohuo.basic.log.event;


import lombok.AllArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.scheduling.annotation.Async;
import com.luohuo.basic.context.ContextUtil;
import com.luohuo.basic.model.log.OptLogDTO;

import java.util.function.Consumer;


/**
 * 异步监听日志事件
 *
 * @author 乾乾
 * @date 2019-07-01 15:13
 */
public class SysLogListener {
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(SysLogListener.class);

    private final Consumer<OptLogDTO> consumer;

    public SysLogListener(Consumer<OptLogDTO> consumer) {
        this.consumer = consumer;
    }

    @Async
    @Order
    @EventListener(SysLogEvent.class)
    public void saveSysLog(SysLogEvent event) {
        OptLogDTO sysLog = (OptLogDTO) event.getSource();
        ContextUtil.setToken(sysLog.getToken());
        consumer.accept(sysLog);
    }

}
