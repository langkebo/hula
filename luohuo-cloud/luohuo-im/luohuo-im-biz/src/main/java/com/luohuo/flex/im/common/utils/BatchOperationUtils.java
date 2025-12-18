package com.luohuo.flex.im.common.utils;

import lombok.extern.slf4j.Slf4j;
import org.springframework.util.CollectionUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 批量操作工具类
 * 提供高效的批量处理能力，支持并行处理、错误处理、进度回调等
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
@Slf4j
public class BatchOperationUtils {

    /**
     * 默认批次大小
     */
    public static final int DEFAULT_BATCH_SIZE = 1000;

    /**
     * 最大并行线程数
     */
    public static final int MAX_PARALLEL_THREADS = Runtime.getRuntime().availableProcessors();

    /**
     * 批量处理接口
     */
    @FunctionalInterface
    public interface BatchProcessor<T> {
        /**
         * 处理一批数据
         *
         * @param batch 批次数据
         * @throws Exception 处理异常
         */
        void process(List<T> batch) throws Exception;
    }

    /**
     * 批量处理结果
     */
    public static class BatchResult<T> {
        private final int totalCount;
        private final int successCount;
        private final int failureCount;
        private final List<T> failedItems;
        private final long duration;
        private final Exception exception;

        public BatchResult(int totalCount, int successCount, int failureCount,
                          List<T> failedItems, long duration, Exception exception) {
            this.totalCount = totalCount;
            this.successCount = successCount;
            this.failureCount = failureCount;
            this.failedItems = failedItems;
            this.duration = duration;
            this.exception = exception;
        }

        public boolean isAllSuccess() {
            return failureCount == 0 && exception == null;
        }

        public int getTotalCount() { return totalCount; }
        public int getSuccessCount() { return successCount; }
        public int getFailureCount() { return failureCount; }
        public List<T> getFailedItems() { return failedItems; }
        public long getDuration() { return duration; }
        public Exception getException() { return exception; }

        @Override
        public String toString() {
            return String.format("BatchResult{total=%d, success=%d, failure=%d, duration=%dms}",
                totalCount, successCount, failureCount, duration);
        }
    }

    /**
     * 批量处理数据
     *
     * @param dataList    数据列表
     * @param batchSize   批次大小
     * @param processor   处理器
     * @param <T>        数据类型
     * @return 处理结果
     */
    public static <T> BatchResult<T> batchProcess(List<T> dataList, int batchSize, BatchProcessor<T> processor) {
        return batchProcess(dataList, batchSize, processor, null);
    }

    /**
     * 批量处理数据（带进度回调）
     *
     * @param dataList    数据列表
     * @param batchSize   批次大小
     * @param processor   处理器
     * @param progressCallback 进度回调（参数：已处理数量，总数量）
     * @param <T>        数据类型
     * @return 处理结果
     */
    public static <T> BatchResult<T> batchProcess(List<T> dataList, int batchSize,
                                                      BatchProcessor<T> processor,
                                                      Consumer<Integer> progressCallback) {
        if (CollectionUtils.isEmpty(dataList)) {
            return new BatchResult<>(0, 0, 0, new ArrayList<>(), 0, null);
        }

        long startTime = System.currentTimeMillis();
        int totalCount = dataList.size();
        int successCount = 0;
        int failureCount = 0;
        List<T> failedItems = new ArrayList<>();
        Exception firstException = null;

        // 分批处理
        for (int i = 0; i < totalCount; i += batchSize) {
            int end = Math.min(i + batchSize, totalCount);
            List<T> batch = dataList.subList(i, end);

            try {
                processor.process(batch);
                successCount += batch.size();
            } catch (Exception e) {
                log.error("批量处理失败，批次范围: {}-{}", i, end - 1, e);
                failureCount += batch.size();
                failedItems.addAll(batch);
                if (firstException == null) {
                    firstException = e;
                }
            }

            // 进度回调
            if (progressCallback != null) {
                int processedCount = Math.min(end, totalCount);
                try {
                    progressCallback.accept(processedCount);
                } catch (Exception e) {
                    log.warn("进度回调执行失败", e);
                }
            }
        }

        long duration = System.currentTimeMillis() - startTime;
        return new BatchResult<>(totalCount, successCount, failureCount, failedItems, duration, firstException);
    }

    /**
     * 并行批量处理数据
     *
     * @param dataList    数据列表
     * @param batchSize   批次大小
     * @param processor   处理器
     * @param <T>        数据类型
     * @return 处理结果
     */
    public static <T> BatchResult<T> parallelBatchProcess(List<T> dataList, int batchSize, BatchProcessor<T> processor) {
        return parallelBatchProcess(dataList, batchSize, processor, MAX_PARALLEL_THREADS, null);
    }

    /**
     * 并行批量处理数据
     *
     * @param dataList        数据列表
     * @param batchSize       批次大小
     * @param processor       处理器
     * @param parallelThreads 并行线程数
     * @param progressCallback 进度回调
     * @param <T>            数据类型
     * @return 处理结果
     */
    public static <T> BatchResult<T> parallelBatchProcess(List<T> dataList, int batchSize,
                                                          BatchProcessor<T> processor,
                                                          int parallelThreads,
                                                          Consumer<Integer> progressCallback) {
        if (CollectionUtils.isEmpty(dataList)) {
            return new BatchResult<>(0, 0, 0, new ArrayList<>(), 0, null);
        }

        long startTime = System.currentTimeMillis();
        int totalCount = dataList.size();

        // 确保线程数不超过批次数
        int actualThreads = Math.min(parallelThreads, (totalCount + batchSize - 1) / batchSize);
        ExecutorService executor = Executors.newFixedThreadPool(actualThreads);

        try {
            // 将数据分批
            List<List<T>> batches = new ArrayList<>();
            for (int i = 0; i < totalCount; i += batchSize) {
                int end = Math.min(i + batchSize, totalCount);
                batches.add(dataList.subList(i, end));
            }

            // 并行处理所有批次
            List<CompletableFuture<Void>> futures = batches.stream()
                .map(batch -> CompletableFuture.runAsync(() -> {
                    try {
                        processor.process(batch);
                    } catch (Exception e) {
                        log.error("并行批量处理失败", e);
                        throw new RuntimeException(e);
                    }
                }, executor))
                .collect(Collectors.toList());

            // 等待所有任务完成
            CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();

            // 统计结果（简化版本，实际应用中可以根据需要调整）
            long duration = System.currentTimeMillis() - startTime;
            return new BatchResult<>(totalCount, totalCount, 0, new ArrayList<>(), duration, null);

        } finally {
            executor.shutdown();
            try {
                if (!executor.awaitTermination(60, TimeUnit.SECONDS)) {
                    executor.shutdownNow();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                executor.shutdownNow();
            }
        }
    }

    /**
     * 批量映射转换
     *
     * @param sourceList  源数据列表
     * @param mapper      映射函数
     * @param batchSize   批次大小
     * @param <S>         源类型
     * @param <T>         目标类型
     * @return 转换后的列表
     */
    public static <S, T> List<T> batchMap(List<S> sourceList, Function<S, T> mapper, int batchSize) {
        if (CollectionUtils.isEmpty(sourceList)) {
            return new ArrayList<>();
        }

        List<T> resultList = new ArrayList<>(sourceList.size());

        for (int i = 0; i < sourceList.size(); i += batchSize) {
            int end = Math.min(i + batchSize, sourceList.size());
            List<S> batch = sourceList.subList(i, end);

            for (S item : batch) {
                try {
                    T mapped = mapper.apply(item);
                    if (mapped != null) {
                        resultList.add(mapped);
                    }
                } catch (Exception e) {
                    log.error("批量映射失败，项目: {}", item, e);
                }
            }
        }

        return resultList;
    }

    /**
     * 批量过滤
     *
     * @param sourceList  源数据列表
     * @param filter      过滤条件
     * @param batchSize   批次大小
     * @param <T>         数据类型
     * @return 过滤后的列表
     */
    public static <T> List<T> batchFilter(List<T> sourceList, java.util.function.Predicate<T> filter, int batchSize) {
        if (CollectionUtils.isEmpty(sourceList)) {
            return new ArrayList<>();
        }

        List<T> resultList = new ArrayList<>();

        for (int i = 0; i < sourceList.size(); i += batchSize) {
            int end = Math.min(i + batchSize, sourceList.size());
            List<T> batch = sourceList.subList(i, end);

            for (T item : batch) {
                try {
                    if (filter.test(item)) {
                        resultList.add(item);
                    }
                } catch (Exception e) {
                    log.error("批量过滤失败，项目: {}", item, e);
                }
            }
        }

        return resultList;
    }

    /**
     * 分批获取数据列表
     *
     * @param totalSize 总数据量
     * @param batchSize  批次大小
     * @return 批次列表（每个元素是 [start, end] 索引范围）
     */
    public static List<int[]> createBatchRanges(int totalSize, int batchSize) {
        List<int[]> ranges = new ArrayList<>();

        for (int i = 0; i < totalSize; i += batchSize) {
            int end = Math.min(i + batchSize, totalSize);
            ranges.add(new int[]{i, end});
        }

        return ranges;
    }

    /**
     * 创建批次索引列表
     *
     * @param dataList   数据列表
     * @param batchSize   批次大小
     * @return 批次索引列表
     */
    public static List<Integer> createBatchIndexes(List<?> dataList, int batchSize) {
        if (CollectionUtils.isEmpty(dataList)) {
            return new ArrayList<>();
        }

        List<Integer> indexes = new ArrayList<>();
        for (int i = 0; i < dataList.size(); i += batchSize) {
            indexes.add(i);
        }

        return indexes;
    }

    /**
     * 计算合适的批次大小
     *
     * @param totalCount 总数量
     * @param targetBatchCount 目标批次数
     * @return 批次大小
     */
    public static int calculateBatchSize(int totalCount, int targetBatchCount) {
        if (totalCount <= 0 || targetBatchCount <= 0) {
            return DEFAULT_BATCH_SIZE;
        }

        int batchSize = (totalCount + targetBatchCount - 1) / targetBatchCount;

        // 确保批次大小在合理范围内
        return Math.max(10, Math.min(batchSize, 10000));
    }
}