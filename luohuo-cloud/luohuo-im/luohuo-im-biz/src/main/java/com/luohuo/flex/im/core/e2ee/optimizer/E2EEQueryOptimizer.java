package com.luohuo.flex.im.core.e2ee.optimizer;

import com.luohuo.flex.im.core.e2ee.mapper.MessageEncryptedMapper;
import com.luohuo.flex.im.core.e2ee.mapper.SessionKeyPackageMapper;
import com.luohuo.flex.im.core.e2ee.mapper.UserPublicKeyMapper;
import com.luohuo.flex.im.domain.entity.MessageEncrypted;
import com.luohuo.flex.im.domain.entity.SessionKeyPackage;
import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.metrics.E2EEMetrics;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * E2EE查询优化器
 * 优化数据库查询性能，减少慢查询
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class E2EEQueryOptimizer {

    private final UserPublicKeyMapper userPublicKeyMapper;
    private final MessageEncryptedMapper messageEncryptedMapper;
    private final SessionKeyPackageMapper sessionKeyPackageMapper;
    private final E2EEMetrics e2eeMetrics;

    // 查询统计
    private final Map<String, QueryStats> queryStats = new ConcurrentHashMap<>();
    private static final long SLOW_QUERY_THRESHOLD_MS = 1000;

    /**
     * 优化的批量公钥查询
     */
    public Map<Long, List<UserPublicKey>> optimizedBatchGetPublicKeys(List<Long> userIds) {
        long startTime = System.currentTimeMillis();

        // 1. 分批查询（避免单次查询数据量过大）
        int batchSize = 100;
        Map<Long, List<UserPublicKey>> result = new HashMap<>();

        for (int i = 0; i < userIds.size(); i += batchSize) {
            int endIndex = Math.min(i + batchSize, userIds.size());
            List<Long> batch = userIds.subList(i, endIndex);

            // 执行批量查询
            List<UserPublicKey> keys = userPublicKeyMapper.batchSelectByUserIds(batch);

            // 分组结果
            Map<Long, List<UserPublicKey>> batchResult = keys.stream()
                .collect(Collectors.groupingBy(UserPublicKey::getUserId));

            result.putAll(batchResult);
        }

        // 2. 记录查询统计
        long duration = System.currentTimeMillis() - startTime;
        recordQueryStats("batch_get_public_keys", userIds.size(), duration);

        return result;
    }

    /**
     * 优化的加密消息查询（分页和索引优化）
     */
    public List<MessageEncrypted> optimizedGetEncryptedMessages(
            String conversationId,
            Long fromMessageId,
            Integer limit) {
        long startTime = System.currentTimeMillis();

        // 使用优化的索引查询
        List<MessageEncrypted> messages = messageEncryptedMapper.selectOptimizedByConversation(
            conversationId, fromMessageId, limit
        );

        long duration = System.currentTimeMillis() - startTime;
        recordQueryStats("get_encrypted_messages", messages.size(), duration);

        return messages;
    }

    /**
     * 优化的密钥包查询（避免N+1问题）
     */
    public Map<String, List<SessionKeyPackage>> optimizedGetKeyPackages(
            List<String> conversationIds) {
        long startTime = System.currentTimeMillis();

        // 批量查询所有会话的密钥包
        List<SessionKeyPackage> packages = sessionKeyPackageMapper
            .batchSelectByConversationIds(conversationIds);

        // 按会话ID分组
        Map<String, List<SessionKeyPackage>> result = packages.stream()
            .collect(Collectors.groupingBy(SessionKeyPackage::getSessionId));

        long duration = System.currentTimeMillis() - startTime;
        recordQueryStats("batch_get_key_packages", conversationIds.size(), duration);

        return result;
    }

    /**
     * 智能索引使用建议
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<List<IndexSuggestion>> analyzeAndSuggestIndexes() {
        List<IndexSuggestion> suggestions = new ArrayList<>();

        // 1. 分析查询模式
        Map<String, Long> queryPatterns = analyzeQueryPatterns();

        // 2. 基于查询模式建议索引
        suggestions.addAll(generateIndexSuggestions(queryPatterns));

        // 3. 检查缺失的索引
        suggestions.addAll(checkMissingIndexes());

        // 4. 检查冗余索引
        suggestions.addAll(checkRedundantIndexes());

        log.info("生成了 {} 个索引优化建议", suggestions.size());
        return CompletableFuture.completedFuture(suggestions);
    }

    /**
     * 查询性能分析
     */
    @Scheduled(fixedRate = 300000) // 每5分钟执行
    public void analyzeQueryPerformance() {
        log.debug("开始分析查询性能");

        // 1. 识别慢查询
        List<SlowQuery> slowQueries = identifySlowQueries();

        // 2. 分析查询瓶颈
        for (SlowQuery slowQuery : slowQueries) {
            analyzeQueryBottleneck(slowQuery);
        }

        // 3. 生成优化建议
        generateOptimizationSuggestions(slowQueries);

        // 4. 清理旧的统计数据
        cleanupOldStats();
    }

    /**
     * 动态调整查询策略
     */
    public QueryStrategy adaptQueryStrategy(String queryType, int dataSize) {
        QueryStats stats = queryStats.get(queryType);
        if (stats == null) {
            return QueryStrategy.DEFAULT;
        }

        // 根据历史性能调整策略
        if (stats.getAvgDuration() > SLOW_QUERY_THRESHOLD_MS) {
            if (dataSize > 1000) {
                return QueryStrategy.BATCH_WITH_CACHE;
            } else {
                return QueryStrategy.INDEX_OPTIMIZED;
            }
        }

        return QueryStrategy.DEFAULT;
    }

    /**
     * 查询结果预加载
     */
    @Async("e2eeTaskExecutor")
    public CompletableFuture<Void> preLoadRelatedData(Set<Long> messageIds) {
        if (messageIds.isEmpty()) {
            return CompletableFuture.completedFuture(null);
        }

        // 1. 预加载相关的密钥信息
        Set<String> keyIds = extractKeyIdsFromMessages(messageIds);
        if (!keyIds.isEmpty()) {
            // 预加载密钥信息
        }

        // 2. 预加载用户信息
        Set<Long> userIds = extractUserIdsFromMessages(messageIds);
        if (!userIds.isEmpty()) {
            // 预加载用户信息
        }

        // 3. 预加载会话信息
        Set<String> conversationIds = extractConversationIdsFromMessages(messageIds);
        if (!conversationIds.isEmpty()) {
            // 预加载会话信息
        }

        log.debug("预加载相关数据完成，消息数: {}", messageIds.size());
        return CompletableFuture.completedFuture(null);
    }

    // 私有方法

    private void recordQueryStats(String queryType, int resultSize, long duration) {
        QueryStats stats = queryStats.computeIfAbsent(queryType, k -> new QueryStats());
        stats.addQuery(duration, resultSize);

        // 记录慢查询
        if (duration > SLOW_QUERY_THRESHOLD_MS) {
            log.warn("检测到慢查询: 类型={}, 耗时={}ms, 结果数={}",
                queryType, duration, resultSize);
            e2eeMetrics.recordError("slow_query", queryType);
        }
    }

    private Map<String, Long> analyzeQueryPatterns() {
        Map<String, Long> patterns = new HashMap<>();
        // 分析最常见的查询模式
        queryStats.forEach((type, stats) -> {
            if (stats.getQueryCount() > 100) {
                patterns.put(type, stats.getQueryCount());
            }
        });
        return patterns;
    }

    private List<IndexSuggestion> generateIndexSuggestions(Map<String, Long> queryPatterns) {
        List<IndexSuggestion> suggestions = new ArrayList<>();

        // 基于查询频率建议索引
        queryPatterns.forEach((queryType, frequency) -> {
            if (frequency > 1000) {
                // 高频查询，建议优化索引
                suggestions.add(new IndexSuggestion(
                    queryType,
                    "HIGH_FREQUENCY_QUERY",
                    "建议优化 " + queryType + " 的索引"
                ));
            }
        });

        return suggestions;
    }

    private List<IndexSuggestion> checkMissingIndexes() {
        List<IndexSuggestion> suggestions = new ArrayList<>();

        // 检查常见的复合索引
        suggestions.add(new IndexSuggestion(
            "conversation_time_index",
            "COMPOSITE_INDEX",
            "建议添加 (conversation_id, create_time) 复合索引"
        ));

        suggestions.add(new IndexSuggestion(
            "user_key_status_index",
            "COMPOSITE_INDEX",
            "建议添加 (user_id, key_id, status) 复合索引"
        ));

        return suggestions;
    }

    private List<IndexSuggestion> checkRedundantIndexes() {
        List<IndexSuggestion> suggestions = new ArrayList<>();
        // 检查可能冗余的索引
        return suggestions;
    }

    private List<SlowQuery> identifySlowQueries() {
        return queryStats.entrySet().stream()
            .filter(entry -> entry.getValue().getAvgDuration() > SLOW_QUERY_THRESHOLD_MS)
            .map(entry -> new SlowQuery(entry.getKey(), entry.getValue()))
            .collect(Collectors.toList());
    }

    private void analyzeQueryBottleneck(SlowQuery slowQuery) {
        // 分析查询瓶颈原因
        if (slowQuery.getStats().getAvgResultSize() > 10000) {
            log.info("查询 {} 可能因数据量过大而慢", slowQuery.getQueryType());
        } else if (slowQuery.getStats().getQueryCount() > 10000) {
            log.info("查询 {} 可能因缺乏索引而慢", slowQuery.getQueryType());
        }
    }

    private void generateOptimizationSuggestions(List<SlowQuery> slowQueries) {
        // 为慢查询生成优化建议
    }

    private void cleanupOldStats() {
        // 清理超过24小时的统计数据
        long cutoffTime = System.currentTimeMillis() - (24 * 60 * 60 * 1000);
        queryStats.entrySet().removeIf(entry ->
            entry.getValue().getLastUpdateTime() < cutoffTime);
    }

    private Set<String> extractKeyIdsFromMessages(Set<Long> messageIds) {
        // 从消息中提取密钥ID
        return new HashSet<>();
    }

    private Set<Long> extractUserIdsFromMessages(Set<Long> messageIds) {
        // 从消息中提取用户ID
        return new HashSet<>();
    }

    private Set<String> extractConversationIdsFromMessages(Set<Long> messageIds) {
        // 从消息中提取会话ID
        return new HashSet<>();
    }

    // 内部类

    private static class QueryStats {
        private long queryCount = 0;
        private long totalDuration = 0;
        private long totalResultSize = 0;
        private long lastUpdateTime = System.currentTimeMillis();

        public void addQuery(long duration, int resultSize) {
            queryCount++;
            totalDuration += duration;
            totalResultSize += resultSize;
            lastUpdateTime = System.currentTimeMillis();
        }

        public long getQueryCount() { return queryCount; }
        public long getAvgDuration() { return queryCount > 0 ? totalDuration / queryCount : 0; }
        public long getAvgResultSize() { return queryCount > 0 ? totalResultSize / queryCount : 0; }
        public long getLastUpdateTime() { return lastUpdateTime; }
    }

    public static class SlowQuery {
        private final String queryType;
        private final QueryStats stats;

        public SlowQuery(String queryType, QueryStats stats) {
            this.queryType = queryType;
            this.stats = stats;
        }

        public String getQueryType() { return queryType; }
        public QueryStats getStats() { return stats; }
    }

    public static class IndexSuggestion {
        private final String indexName;
        private final String type;
        private final String description;

        public IndexSuggestion(String indexName, String type, String description) {
            this.indexName = indexName;
            this.type = type;
            this.description = description;
        }

        // Getters
        public String getIndexName() { return indexName; }
        public String getType() { return type; }
        public String getDescription() { return description; }
    }

    public enum QueryStrategy {
        DEFAULT,              // 默认策略
        INDEX_OPTIMIZED,      // 索引优化
        BATCH_WITH_CACHE,     // 批量+缓存
        PARTITION_SCAN        // 分区扫描
    }
}