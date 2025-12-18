package com.luohuo.basic.domain.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.luohuo.basic.base.entity.Entity;
import com.luohuo.basic.domain.dto.SecureInvokeDTO;

import java.time.LocalDateTime;

/**
 * Description:
 * Date: 2023-08-06
 */
@TableName(value = "secure_invoke_record", autoResultMap = true)
public class SecureInvokeRecord extends Entity<Long> {
    public final static byte STATUS_WAIT = 1;
    public final static byte STATUS_FAIL = 2;
    /**
     * 请求快照参数json
     */
    @TableField(value = "secure_invoke_json", typeHandler = JacksonTypeHandler.class)
    private SecureInvokeDTO secureInvokeDTO;
    /**
     * 状态 1待执行 2已失败
     */
    @TableField("state")
    @Builder.Default
    private byte state = SecureInvokeRecord.STATUS_WAIT;
    /**
     * 下一次重试的时间
     */
    @TableField("next_retry_time")
    @Builder.Default
    private LocalDateTime nextRetryTime = LocalDateTime.now();
    /**
     * 已经重试的次数
     */
    @TableField("retry_times")
    @Builder.Default
    private Integer retryTimes = 0;
    @TableField("max_retry_times")
    private Integer maxRetryTimes;
    @TableField("fail_reason")
    private String failReason;

    public SecureInvokeDTO getSecureInvokeDTO() { return secureInvokeDTO; }
    public void setSecureInvokeDTO(SecureInvokeDTO secureInvokeDTO) { this.secureInvokeDTO = secureInvokeDTO; }
    public byte getState() { return state; }
    public void setState(byte state) { this.state = state; }
    public LocalDateTime getNextRetryTime() { return nextRetryTime; }
    public void setNextRetryTime(LocalDateTime nextRetryTime) { this.nextRetryTime = nextRetryTime; }
    public Integer getRetryTimes() { return retryTimes; }
    public void setRetryTimes(Integer retryTimes) { this.retryTimes = retryTimes; }
    public Integer getMaxRetryTimes() { return maxRetryTimes; }
    public void setMaxRetryTimes(Integer maxRetryTimes) { this.maxRetryTimes = maxRetryTimes; }
    public String getFailReason() { return failReason; }
    public void setFailReason(String failReason) { this.failReason = failReason; }
}
