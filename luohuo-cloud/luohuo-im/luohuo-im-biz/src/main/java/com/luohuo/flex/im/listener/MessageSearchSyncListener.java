package com.luohuo.flex.im.listener;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch.core.*;
import co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import co.elastic.clients.elasticsearch.core.bulk.IndexOperation;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import com.luohuo.flex.im.domain.entity.Message;
import com.luohuo.flex.im.service.MessageService;
import com.luohuo.flex.im.search.document.MessageDocument;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.BeanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.event.EventListener;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

/**
 * 消息搜索同步监听器
 * 监听消息事件，自动同步到Elasticsearch
 *
 * @author HuLa
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MessageSearchSyncListener {

    private final ElasticsearchClient elasticsearchClient;
    private final MessageService messageService;

    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;

    @Value("${hula.elasticsearch.index.message:hula_message}")
    private String messageIndex;

    /**
     * 重试队列Redis Key前缀
     */
    private static final String RETRY_QUEUE_KEY = "search:retry:queue";
    
    /**
     * 最大重试次数
     */
    private static final int MAX_RETRY_COUNT = 3;
    
    /**
     * 重试间隔（毫秒）
     */
    private static final long RETRY_INTERVAL_MS = 60000;

    /**
     * 监听消息发送事件
     */
    @EventListener
    @Async("searchSyncExecutor")
    public void handleMessageSent(Message message) {
        try {
            log.debug("Received message sent event, syncing to search: {}", message.getId());

            MessageDocument document = convertToDocument(message);

            IndexRequest<MessageDocument> request = IndexRequest.of(i -> i
                    .index(messageIndex)
                    .id(message.getId().toString())
                    .document(document)
            );

            IndexResponse response = elasticsearchClient.index(request);
            log.debug("Message synced to search: {}, result: {}", message.getId(), response.result());

        } catch (Exception e) {
            log.error("Failed to sync message to search: {}", message.getId(), e);
            // 可以考虑将失败的消息加入重试队列
            addToRetryQueue("INSERT", message);
        }
    }

    /**
     * 监听消息更新事件
     */
    @EventListener
    @Async("searchSyncExecutor")
    public void handleMessageUpdated(Message message) {
        try {
            log.debug("Received message updated event, syncing to search: {}", message.getId());

            MessageDocument document = convertToDocument(message);

            IndexRequest<MessageDocument> request = IndexRequest.of(i -> i
                    .index(messageIndex)
                    .id(message.getId().toString())
                    .document(document)
            );

            IndexResponse response = elasticsearchClient.index(request);
            log.debug("Message update synced to search: {}, result: {}", message.getId(), response.result());

        } catch (Exception e) {
            log.error("Failed to sync message update to search: {}", message.getId(), e);
            addToRetryQueue("UPDATE", message);
        }
    }

    /**
     * 监听消息删除事件
     */
    @EventListener
    @Async("searchSyncExecutor")
    public void handleMessageDeleted(Long messageId) {
        try {
            log.debug("Received message deleted event, removing from search: {}", messageId);

            DeleteRequest request = DeleteRequest.of(d -> d
                    .index(messageIndex)
                    .id(messageId.toString())
            );

            DeleteResponse response = elasticsearchClient.delete(request);
            log.debug("Message removed from search: {}, result: {}", messageId, response.result());

        } catch (Exception e) {
            log.error("Failed to remove message from search: {}", messageId, e);
            addToRetryQueue("DELETE", messageId);
        }
    }

    /**
     * 监听消息撤回事件
     */
    @EventListener
    @Async("searchSyncExecutor")
    public void handleMessageRecalled(Long messageId) {
        try {
            log.debug("Received message recalled event, updating search: {}", messageId);

            // 获取消息详情
            Message message = messageService.getById(messageId);
            if (message != null) {
                // 更新撤回状态
                MessageDocument document = convertToDocument(message);
                document.setRecalled(true);
                document.setRecallTime(new Date());

                IndexRequest<MessageDocument> request = IndexRequest.of(i -> i
                        .index(messageIndex)
                        .id(messageId.toString())
                        .document(document)
                );

                elasticsearchClient.index(request);
                log.debug("Message recall synced to search: {}", messageId);
            }
        } catch (Exception e) {
            log.error("Failed to sync message recall to search: {}", messageId, e);
            addToRetryQueue("RECALL", messageId);
        }
    }

    /**
     * 批量处理消息同步
     */
    public void handleBatchSync(List<Message> messages) {
        try {
            log.debug("Received batch sync event, syncing {} messages to search", messages.size());

            if (messages.isEmpty()) {
                return;
            }

            // 分批处理，每批1000条
            int batchSize = 1000;
            for (int i = 0; i < messages.size(); i += batchSize) {
                int endIndex = Math.min(i + batchSize, messages.size());
                List<Message> batch = messages.subList(i, endIndex);

                processBatch(batch);
            }

        } catch (Exception e) {
            log.error("Failed to batch sync messages to search", e);
        }
    }

    /**
     * 处理用户消息重新索引
     */
    public void handleUserReindex(Long userId) {
        try {
            log.info("Starting user messages reindex: {}", userId);

            // 1. 删除用户的所有消息索引
            deleteUserMessages(userId);

            // 2. 重新索引用户消息
            int pageSize = 1000;
            int offset = 0;
            int totalIndexed = 0;

            while (true) {
                List<Message> messages = messageService.getUserMessages(userId, offset, pageSize);
                if (messages.isEmpty()) {
                    break;
                }

                handleBatchSync(messages);
                totalIndexed += messages.size();
                offset += pageSize;

                log.debug("Reindexed {} messages for user: {}", totalIndexed, userId);
            }

            log.info("User messages reindex completed: {}, total messages: {}", userId, totalIndexed);

        } catch (Exception e) {
            log.error("Failed to reindex user messages: {}", userId, e);
        }
    }

    /**
     * 处理会话消息重新索引
     */
    public void handleConversationReindex(Long conversationId) {
        try {
            log.info("Starting conversation messages reindex: {}", conversationId);

            // 删除会话消息索引
            deleteConversationMessages(conversationId);

            // 重新索引
            int pageSize = 1000;
            int offset = 0;
            int totalIndexed = 0;

            while (true) {
                List<Message> messages = messageService.getConversationMessages(conversationId, offset, pageSize);
                if (messages.isEmpty()) {
                    break;
                }

                handleBatchSync(messages);
                totalIndexed += messages.size();
                offset += pageSize;

                log.debug("Reindexed {} messages for conversation: {}", totalIndexed, conversationId);
            }

            log.info("Conversation messages reindex completed: {}, total messages: {}", conversationId, totalIndexed);

        } catch (Exception e) {
            log.error("Failed to reindex conversation messages: {}", conversationId, e);
        }
    }

    /**
     * 处理批量同步
     */
    private void processBatch(List<Message> messages) {
        try {
            List<BulkOperation> operations = new ArrayList<>();

            for (Message message : messages) {
                MessageDocument document = convertToDocument(message);

                IndexOperation<MessageDocument> indexOp = IndexOperation.of(i -> i
                        .index(messageIndex)
                        .id(message.getId().toString())
                        .document(document)
                );

                operations.add(BulkOperation.of(b -> b.index(indexOp)));
            }

            BulkRequest request = BulkRequest.of(b -> b
                    .operations(operations)
                    .refresh(Refresh.WaitFor)
            );

            BulkResponse response = elasticsearchClient.bulk(request);

            if (response.errors()) {
                log.warn("Bulk sync had errors: {}", response.items().stream()
                        .filter(item -> item.error() != null)
                        .map(item -> item.error().reason())
                        .collect(Collectors.joining(", ")));
            } else {
                log.debug("Batch synced {} messages successfully", messages.size());
            }

        } catch (Exception e) {
            log.error("Failed to process batch sync", e);
            throw e;
        }
    }

    /**
     * 删除用户的所有消息索引
     */
    private void deleteUserMessages(Long userId) throws Exception {
        DeleteByQueryRequest request = DeleteByQueryRequest.of(d -> d
                .index(messageIndex)
                .query(q -> q
                        .term(t -> t
                                .field("userId")
                                .value(userId)
                        )
                )
        );

        DeleteByQueryResponse response = elasticsearchClient.deleteByQuery(request);
        log.info("Deleted {} message documents for user: {}", response.deleted(), userId);
    }

    /**
     * 删除会话的所有消息索引
     */
    private void deleteConversationMessages(Long conversationId) throws Exception {
        DeleteByQueryRequest request = DeleteByQueryRequest.of(d -> d
                .index(messageIndex)
                .query(q -> q
                        .term(t -> t
                                .field("conversationId")
                                .value(conversationId)
                        )
                )
        );

        DeleteByQueryResponse response = elasticsearchClient.deleteByQuery(request);
        log.info("Deleted {} message documents for conversation: {}", response.deleted(), conversationId);
    }

    /**
     * 转换消息实体为搜索文档
     */
    private MessageDocument convertToDocument(Message message) {
        MessageDocument document = new MessageDocument();
        BeanUtils.copyProperties(message, document);

        // 处理特殊字段
        document.setCreatedAt(message.getCreateTime());
        document.setUpdatedAt(message.getUpdateTime());

        // 提取消息内容的可搜索文本
        String searchText = extractSearchText(message);
        document.setSearchText(searchText);

        // 设置搜索权重
        document.setWeight(calculateWeight(message));

        return document;
    }

    /**
     * 提取搜索文本
     */
    private String extractSearchText(Message message) {
        StringBuilder sb = new StringBuilder();

        // 添加消息内容
        if (message.getContent() != null) {
            sb.append(message.getContent()).append(" ");
        }

        // 添加消息类型
        if (message.getType() != null) {
            sb.append(message.getType().name()).append(" ");
        }

        // 添加发送者信息（如果有）
        if (message.getSenderName() != null) {
            sb.append(message.getSenderName()).append(" ");
        }

        return sb.toString().trim();
    }

    /**
     * 计算搜索权重
     */
    private int calculateWeight(Message message) {
        int weight = 1;

        // 文本消息权重较高
        if ("TEXT".equals(message.getType())) {
            weight += 2;
        }

        // 图片消息
        if ("IMAGE".equals(message.getType())) {
            weight += 1;
        }

        // 最近的消息权重更高
        if (message.getCreateTime() != null) {
            long daysDiff = (System.currentTimeMillis() - message.getCreateTime().getTime())
                    / (1000 * 60 * 60 * 24);
            if (daysDiff < 1) {
                weight += 3;
            } else if (daysDiff < 7) {
                weight += 2;
            } else if (daysDiff < 30) {
                weight += 1;
            }
        }

        return weight;
    }

    /**
     * 添加到重试队列
     * 使用Redis List实现可靠的重试队列
     */
    private void addToRetryQueue(String operation, Object data) {
        if (redisTemplate == null) {
            log.warn("Redis not available, cannot add to retry queue - operation: {}, data: {}", operation, data);
            return;
        }
        
        try {
            Map<String, Object> retryTask = new HashMap<>();
            retryTask.put("operation", operation);
            retryTask.put("data", data);
            retryTask.put("retryCount", 0);
            retryTask.put("createTime", System.currentTimeMillis());
            retryTask.put("nextRetryTime", System.currentTimeMillis() + RETRY_INTERVAL_MS);
            
            redisTemplate.opsForList().rightPush(RETRY_QUEUE_KEY, retryTask);
            log.info("Added to retry queue - operation: {}, data: {}", operation, data);
        } catch (Exception e) {
            log.error("Failed to add to retry queue - operation: {}, data: {}", operation, data, e);
        }
    }
    
    /**
     * 定时处理重试队列
     * 每分钟执行一次
     */
    @Scheduled(fixedRate = 60000)
    public void processRetryQueue() {
        if (redisTemplate == null) {
            return;
        }
        
        try {
            Long queueSize = redisTemplate.opsForList().size(RETRY_QUEUE_KEY);
            if (queueSize == null || queueSize == 0) {
                return;
            }
            
            log.debug("Processing retry queue, size: {}", queueSize);
            
            // 处理队列中的任务
            for (int i = 0; i < Math.min(queueSize, 100); i++) {
                Object taskObj = redisTemplate.opsForList().leftPop(RETRY_QUEUE_KEY);
                if (taskObj == null) {
                    break;
                }
                
                @SuppressWarnings("unchecked")
                Map<String, Object> task = (Map<String, Object>) taskObj;
                processRetryTask(task);
            }
        } catch (Exception e) {
            log.error("Failed to process retry queue", e);
        }
    }
    
    /**
     * 处理单个重试任务
     */
    private void processRetryTask(Map<String, Object> task) {
        String operation = (String) task.get("operation");
        Object data = task.get("data");
        int retryCount = ((Number) task.get("retryCount")).intValue();
        long nextRetryTime = ((Number) task.get("nextRetryTime")).longValue();
        
        // 检查是否到达重试时间
        if (System.currentTimeMillis() < nextRetryTime) {
            // 还没到重试时间，放回队列
            redisTemplate.opsForList().rightPush(RETRY_QUEUE_KEY, task);
            return;
        }
        
        // 检查重试次数
        if (retryCount >= MAX_RETRY_COUNT) {
            log.error("Max retry count reached, discarding task - operation: {}, data: {}", operation, data);
            return;
        }
        
        try {
            boolean success = executeRetryOperation(operation, data);
            if (success) {
                log.info("Retry successful - operation: {}, data: {}", operation, data);
            } else {
                // 重试失败，增加重试次数后放回队列
                task.put("retryCount", retryCount + 1);
                task.put("nextRetryTime", System.currentTimeMillis() + RETRY_INTERVAL_MS * (retryCount + 2));
                redisTemplate.opsForList().rightPush(RETRY_QUEUE_KEY, task);
                log.warn("Retry failed, will retry again - operation: {}, retryCount: {}", operation, retryCount + 1);
            }
        } catch (Exception e) {
            // 执行异常，增加重试次数后放回队列
            task.put("retryCount", retryCount + 1);
            task.put("nextRetryTime", System.currentTimeMillis() + RETRY_INTERVAL_MS * (retryCount + 2));
            redisTemplate.opsForList().rightPush(RETRY_QUEUE_KEY, task);
            log.error("Retry execution error - operation: {}, retryCount: {}", operation, retryCount + 1, e);
        }
    }
    
    /**
     * 执行重试操作
     */
    private boolean executeRetryOperation(String operation, Object data) {
        try {
            switch (operation) {
                case "INSERT", "UPDATE" -> {
                    if (data instanceof Message message) {
                        MessageDocument document = convertToDocument(message);
                        IndexRequest<MessageDocument> request = IndexRequest.of(i -> i
                                .index(messageIndex)
                                .id(message.getId().toString())
                                .document(document)
                        );
                        elasticsearchClient.index(request);
                        return true;
                    } else if (data instanceof Map) {
                        @SuppressWarnings("unchecked")
                        Map<String, Object> msgMap = (Map<String, Object>) data;
                        Long messageId = ((Number) msgMap.get("id")).longValue();
                        Message message = messageService.getById(messageId);
                        if (message != null) {
                            MessageDocument document = convertToDocument(message);
                            IndexRequest<MessageDocument> request = IndexRequest.of(i -> i
                                    .index(messageIndex)
                                    .id(message.getId().toString())
                                    .document(document)
                            );
                            elasticsearchClient.index(request);
                            return true;
                        }
                    }
                }
                case "DELETE" -> {
                    Long messageId = data instanceof Long ? (Long) data : ((Number) data).longValue();
                    DeleteRequest request = DeleteRequest.of(d -> d
                            .index(messageIndex)
                            .id(messageId.toString())
                    );
                    elasticsearchClient.delete(request);
                    return true;
                }
                case "RECALL" -> {
                    Long messageId = data instanceof Long ? (Long) data : ((Number) data).longValue();
                    Message message = messageService.getById(messageId);
                    if (message != null) {
                        MessageDocument document = convertToDocument(message);
                        document.setRecalled(true);
                        document.setRecallTime(new Date());
                        IndexRequest<MessageDocument> request = IndexRequest.of(i -> i
                                .index(messageIndex)
                                .id(messageId.toString())
                                .document(document)
                        );
                        elasticsearchClient.index(request);
                        return true;
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to execute retry operation: {}", operation, e);
        }
        return false;
    }

    /**
     * 检查索引是否存在
     */
    public boolean isIndexExists() {
        try {
            ExistsRequest request = ExistsRequest.of(e -> e.index(messageIndex));
            return elasticsearchClient.indices().exists(request).value();
        } catch (Exception e) {
            log.error("Failed to check index existence", e);
            return false;
        }
    }

    /**
     * 创建索引
     */
    public void createIndex() {
        try {
            if (!isIndexExists()) {
                // 索引映射已在 Elasticsearch 配置中定义
                log.info("Creating search index: {}", messageIndex);
            }
        } catch (Exception e) {
            log.error("Failed to create search index", e);
        }
    }
}