package com.luohuo.flex.im.api;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 推送统计信息
 *
 * @author HuLa
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PushStatistics {

    /**
     * 总推送数
     */
    private Long totalCount;

    /**
     * 成功推送数
     */
    private Long successCount;

    /**
     * 失败推送数
     */
    private Long failureCount;

    /**
     * APNs推送数
     */
    private Long apnsCount;

    /**
     * FCM推送数
     */
    private Long fcmCount;

    /**
     * 华为推送数
     */
    private Long huaweiCount;

    /**
     * 小米推送数
     */
    private Long xiaomiCount;

    /**
     * OPPO推送数
     */
    private Long oppoCount;

    /**
     * vivo推送数
     */
    private Long vivoCount;

    /**
     * 成功率
     */
    public Double getSuccessRate() {
        if (totalCount == null || totalCount == 0) {
            return 0.0;
        }
        return (successCount.doubleValue() / totalCount) * 100;
    }
}