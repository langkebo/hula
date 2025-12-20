package com.luohuo.flex.im.service.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.flex.im.api.PushStatistics;
import com.luohuo.flex.im.domain.entity.PushRecord;
import com.luohuo.flex.im.mapper.PushRecordMapper;
import com.luohuo.flex.im.service.PushRecordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 推送记录服务实现
 *
 * @author HuLa
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PushRecordServiceImpl implements PushRecordService {

    private final PushRecordMapper pushRecordMapper;
    private final ObjectMapper objectMapper;

    /**
     * 推送状态常量
     */
    public static final String STATUS_PENDING = "pending";
    public static final String STATUS_SUCCESS = "success";
    public static final String STATUS_FAILED = "failed";

    @Override
    public PushRecord createRecord(Long userId, String deviceToken, String pushType,
                                   String title, String content, Map<String, Object> extra) {
        PushRecord record = new PushRecord();
        record.setUserId(userId);
        record.setDeviceToken(deviceToken);
        record.setPushType(pushType);
        record.setTitle(title);
        record.setContent(content);
        record.setStatus(STATUS_PENDING);
        record.setCreateTime(LocalDateTime.now());

        // 序列化extra为JSON字符串
        if (extra != null && !extra.isEmpty()) {
            try {
                record.setExtra(objectMapper.writeValueAsString(extra));
            } catch (JsonProcessingException e) {
                log.warn("Failed to serialize extra data: {}", e.getMessage());
                record.setExtra("{}");
            }
        }

        pushRecordMapper.insert(record);
        log.debug("Created push record: id={}, userId={}, type={}", record.getId(), userId, pushType);
        return record;
    }

    @Override
    public void updateStatus(Long recordId, String status, String errorMessage) {
        if (recordId == null) {
            log.warn("Cannot update status: recordId is null");
            return;
        }

        int updated = pushRecordMapper.updateStatus(recordId, status, errorMessage);
        if (updated > 0) {
            log.debug("Updated push record status: id={}, status={}", recordId, status);
        } else {
            log.warn("Failed to update push record status: id={}", recordId);
        }
    }

    @Override
    public PushStatistics getStatistics(LocalDateTime startTime, LocalDateTime endTime) {
        try {
            // 获取总数
            long totalCount = pushRecordMapper.countTotal(startTime, endTime);

            // 按状态统计
            long successCount = pushRecordMapper.countByStatus(STATUS_SUCCESS, startTime, endTime);
            long failureCount = pushRecordMapper.countByStatus(STATUS_FAILED, startTime, endTime);

            // 按类型统计
            List<Map<String, Object>> typeStats = pushRecordMapper.countGroupByType(startTime, endTime);
            Map<String, Long> typeCountMap = new HashMap<>();
            for (Map<String, Object> stat : typeStats) {
                String pushType = (String) stat.get("pushType");
                Long count = ((Number) stat.get("count")).longValue();
                typeCountMap.put(pushType, count);
            }

            return PushStatistics.builder()
                    .totalCount(totalCount)
                    .successCount(successCount)
                    .failureCount(failureCount)
                    .apnsCount(typeCountMap.getOrDefault("apns", 0L))
                    .fcmCount(typeCountMap.getOrDefault("fcm", 0L))
                    .huaweiCount(typeCountMap.getOrDefault("huawei", 0L))
                    .xiaomiCount(typeCountMap.getOrDefault("xiaomi", 0L))
                    .oppoCount(typeCountMap.getOrDefault("oppo", 0L))
                    .vivoCount(typeCountMap.getOrDefault("vivo", 0L))
                    .build();

        } catch (Exception e) {
            log.error("Failed to get push statistics", e);
            return PushStatistics.builder()
                    .totalCount(0L)
                    .successCount(0L)
                    .failureCount(0L)
                    .apnsCount(0L)
                    .fcmCount(0L)
                    .huaweiCount(0L)
                    .xiaomiCount(0L)
                    .oppoCount(0L)
                    .vivoCount(0L)
                    .build();
        }
    }

    @Override
    public Map<String, Long> countByType(LocalDateTime startTime, LocalDateTime endTime) {
        Map<String, Long> result = new HashMap<>();
        try {
            List<Map<String, Object>> typeStats = pushRecordMapper.countGroupByType(startTime, endTime);
            for (Map<String, Object> stat : typeStats) {
                String pushType = (String) stat.get("pushType");
                Long count = ((Number) stat.get("count")).longValue();
                result.put(pushType, count);
            }
        } catch (Exception e) {
            log.error("Failed to count by type", e);
        }
        return result;
    }

    @Override
    public PushRecord getById(Long id) {
        if (id == null) {
            return null;
        }
        return pushRecordMapper.selectById(id);
    }
}
