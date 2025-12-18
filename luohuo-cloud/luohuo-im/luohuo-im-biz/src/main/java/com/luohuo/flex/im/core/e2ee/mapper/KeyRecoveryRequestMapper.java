package com.luohuo.flex.im.core.e2ee.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.luohuo.flex.im.domain.entity.KeyRecoveryRequest;
import com.luohuo.flex.im.domain.enums.RecoveryStatus;
import com.luohuo.flex.im.domain.enums.RecoveryType;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 密钥恢复请求Mapper接口
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Mapper
public interface KeyRecoveryRequestMapper extends BaseMapper<KeyRecoveryRequest> {

    /**
     * 根据用户ID和密钥ID查询有效的恢复请求
     */
    KeyRecoveryRequest selectByUserIdAndKeyId(@Param("userId") Long userId,
                                            @Param("keyId") String keyId);

    /**
     * 根据恢复令牌查询请求
     */
    KeyRecoveryRequest selectByRecoveryToken(@Param("token") String token);

    /**
     * 更新恢复请求状态
     */
    int updateStatus(@Param("id") Long id,
                    @Param("status") RecoveryStatus status,
                    @Param("reviewerId") Long reviewerId,
                    @Param("reviewComment") String reviewComment);

    /**
     * 增加验证次数
     */
    int incrementVerificationAttempts(@Param("id") Long id);

    /**
     * 查询用户的恢复请求历史
     */
    IPage<KeyRecoveryRequest> selectUserRecoveryHistory(Page<KeyRecoveryRequest> page,
                                                      @Param("userId") Long userId,
                                                      @Param("keyId") String keyId);

    /**
     * 查询待审核的恢复请求
     */
    IPage<KeyRecoveryRequest> selectPendingRequests(Page<KeyRecoveryRequest> page,
                                                  @Param("tenantId") Long tenantId,
                                                  @Param("recoveryType") RecoveryType recoveryType);

    /**
     * 查询过期的恢复请求
     */
    List<KeyRecoveryRequest> selectExpiredRequests(@Param("now") LocalDateTime now);

    /**
     * 批量更新过期状态
     */
    int batchUpdateExpiredStatus(@Param("ids") List<Long> ids,
                                @Param("status") RecoveryStatus status);

    /**
     * 查询统计信息
     */
    List<RecoveryStats> selectRecoveryStats(@Param("tenantId") Long tenantId,
                                          @Param("startDate") LocalDateTime startDate,
                                          @Param("endDate") LocalDateTime endDate);

    /**
     * 查询用户最近的恢复请求
     */
    KeyRecoveryRequest selectLatestByUserId(@Param("userId") Long userId);

    /**
     * 检查是否有正在进行的恢复请求
     */
    int countActiveRequestsByUserId(@Param("userId") Long userId);

    /**
     * 查询指定时间范围内的请求
     */
    List<KeyRecoveryRequest> selectByDateRange(@Param("startDate") LocalDateTime startDate,
                                             @Param("endDate") LocalDateTime endDate);

    /**
     * 统计接口
     */
    interface RecoveryStats {
        Long getRecoveryType();
        Long getTotalCount();
        Long getPendingCount();
        Long getApprovedCount();
        Long getRejectedCount();
        Long getCompletedCount();
        Double getAvgCompletionHours();
    }
}