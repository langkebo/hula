package com.luohuo.flex.im.search.service.impl;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.GeoDistanceQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.RangeQuery;
import co.elastic.clients.elasticsearch.core.SearchRequest;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.elasticsearch.core.search.Suggestion;
import co.elastic.clients.elasticsearch.core.search.SuggestFuzziness;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.luohuo.flex.im.search.config.ElasticsearchConfig;
import com.luohuo.flex.im.search.document.MessageDocument;
import com.luohuo.flex.im.search.dto.SearchRequest;
import com.luohuo.flex.im.search.dto.SearchResponse;
import com.luohuo.flex.im.search.service.MessageSearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

/**
 * 消息搜索服务实现
 *
 * @author HuLa
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MessageSearchServiceImpl implements MessageSearchService {

    private final ElasticsearchClient elasticsearchClient;
    private final ElasticsearchConfig elasticsearchConfig;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private RedisTemplate<String, Object> redisTemplate;

    private static final String SEARCH_HISTORY_KEY = "search:history:user:";
    private static final String HOT_SEARCH_KEY = "search:hot";
    private static final String SEARCH_SUGGESTION_KEY = "search:suggestion:";

    @Override
    public SearchResponse<?> searchMessages(SearchRequest request) {
        return searchMessagesAsync(request).join();
    }

    @Override
    public SearchResponse<?> searchMessagesSync(SearchRequest request) {
        long startTime = System.currentTimeMillis();

        try {
            // 构建搜索请求
            SearchRequest.Builder searchBuilder = new SearchRequest.Builder()
                    .index(elasticsearchConfig.getMessageIndex())
                    .from(request.getOffset())
                    .size(request.getSize());

            // 构建查询
            Query query = buildMessageQuery(request);
            searchBuilder.query(query);

            // 构建排序
            buildSort(searchBuilder, request);

            // 构建高亮
            if (request.getHighlight()) {
                searchBuilder.highlight(h -> h
                        .fields("content", hf -> hf
                                .preTags("<mark>")
                                .postTags("</mark>")
                                .fragmentSize(150)
                                .numberOfFragments(3)
                        )
                        .fields("searchText", hf -> hf
                                .preTags("<mark>")
                                .postTags("</mark>")
                                .fragmentSize(100)
                                .numberOfFragments(2)
                        )
                );
            }

            // 添加聚合
            buildAggregations(searchBuilder);

            // 执行搜索
            SearchResponse<MessageDocument> response = elasticsearchClient
                    .search(searchBuilder.build(), MessageDocument.class);

            // 处理结果
            List<MessageDocument> documents = response.hits().hits().stream()
                    .map(Hit::source)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            // 设置高亮信息
            if (request.getHighlight()) {
                setHighlightInfo(documents, response.hits().hits());
            }

            long took = System.currentTimeMillis() - startTime;
            SearchResponse<MessageDocument> searchResponse = new SearchResponse<>(
                    documents,
                    response.hits().total().value(),
                    request.getPage(),
                    request.getSize()
            );
            searchResponse.setTook(took);

            // 处理聚合结果
            if (response.aggregations() != null) {
                searchResponse.setAggregations(processAggregations(response));
            }

            // 异步记录搜索历史和建议
            CompletableFuture.runAsync(() -> {
                recordSearchHistory(request.getUserId(), request.getKeyword());
                updateHotSearch(request.getKeyword());
            });

            return searchResponse;

        } catch (Exception e) {
            log.error("Failed to search messages", e);
            return new SearchResponse<>(Collections.emptyList(), 0L, request.getPage(), request.getSize());
        }
    }

    @Override
    public SearchResponse<?> searchUsers(SearchRequest request) {
        // TODO: 实现用户搜索
        return new SearchResponse<>(Collections.emptyList(), 0L, request.getPage(), request.getSize());
    }

    @Override
    public SearchResponse<?> searchConversations(SearchRequest request) {
        // TODO: 实现会话搜索
        return new SearchResponse<>(Collections.emptyList(), 0L, request.getPage(), request.getSize());
    }

    @Override
    public SearchResponse<?> searchFiles(SearchRequest request) {
        // TODO: 实现文件搜索
        return new SearchResponse<>(Collections.emptyList(), 0L, request.getPage(), request.getSize());
    }

    @Override
    public SearchResponse<?> searchImages(SearchRequest request) {
        // TODO: 实现图片搜索
        return new SearchResponse<>(Collections.emptyList(), 0L, request.getPage(), request.getSize());
    }

    @Override
    public List<String> getSuggestions(String keyword, Long userId) {
        try {
            // 先从Redis缓存获取
            String cacheKey = SEARCH_SUGGESTION_KEY + keyword.toLowerCase();
            if (redisTemplate != null) {
                List<String> cached = (List<String>) redisTemplate.opsForValue().get(cacheKey);
                if (cached != null) {
                    return cached;
                }
            }

            // 从Elasticsearch获取建议
            SearchRequest.Builder suggestBuilder = new SearchRequest.Builder()
                    .index(elasticsearchConfig.getMessageIndex())
                    .suggest(s -> s
                            .suggesters("message_suggest", ss -> ss
                                    .prefix(keyword)
                                    .completion(cs -> cs
                                            .field("content.suggest")
                                            .size(10)
                                            .skipDuplicates(true)
                                            .fuzziness(SuggestFuzziness.AUTO)
                                    )
                            )
                    );

            SearchResponse<Void> response = elasticsearchClient.search(suggestBuilder.build(), Void.class);

            List<String> suggestions = response.suggest().get("message_suggest").stream()
                    .flatMap(s -> s.completion().options().stream())
                    .map(option -> option.text())
                    .distinct()
                    .limit(10)
                    .collect(Collectors.toList());

            // 缓存结果
            if (redisTemplate != null && !suggestions.isEmpty()) {
                redisTemplate.opsForValue().set(cacheKey, suggestions, Duration.ofMinutes(30));
            }

            return suggestions;

        } catch (Exception e) {
            log.error("Failed to get suggestions for keyword: {}", keyword, e);
            return Collections.emptyList();
        }
    }

    @Override
    public List<String> getHotSearches(Long userId, Integer limit) {
        try {
            // 从Redis获取热门搜索
            if (redisTemplate != null) {
                Set<Object> hotSearches = redisTemplate.opsForZSet()
                        .reverseRange(HOT_SEARCH_KEY, 0, limit - 1);
                if (hotSearches != null) {
                    return hotSearches.stream()
                            .map(Object::toString)
                            .collect(Collectors.toList());
                }
            }
            return Collections.emptyList();
        } catch (Exception e) {
            log.error("Failed to get hot searches", e);
            return Collections.emptyList();
        }
    }

    @Override
    public void recordSearchHistory(Long userId, String keyword) {
        if (userId == null || !StringUtils.hasText(keyword)) {
            return;
        }

        try {
            if (redisTemplate != null) {
                String key = SEARCH_HISTORY_KEY + userId;
                redisTemplate.opsForZSet().add(key, keyword, System.currentTimeMillis());

                // 只保留最近100条记录
                redisTemplate.opsForZSet().removeRange(key, 0, -101);
                redisTemplate.expire(key, Duration.ofDays(30));
            }
        } catch (Exception e) {
            log.error("Failed to record search history", e);
        }
    }

    @Override
    public void clearSearchHistory(Long userId) {
        if (userId == null) {
            return;
        }

        try {
            if (redisTemplate != null) {
                redisTemplate.delete(SEARCH_HISTORY_KEY + userId);
            }
        } catch (Exception e) {
            log.error("Failed to clear search history", e);
        }
    }

    @Override
    public List<String> getSearchHistory(Long userId, Integer limit) {
        if (userId == null) {
            return Collections.emptyList();
        }

        try {
            if (redisTemplate != null) {
                Set<Object> history = redisTemplate.opsForZSet()
                        .reverseRange(SEARCH_HISTORY_KEY + userId, 0, limit - 1);
                if (history != null) {
                    return history.stream()
                            .map(Object::toString)
                            .collect(Collectors.toList());
                }
            }
            return Collections.emptyList();
        } catch (Exception e) {
            log.error("Failed to get search history", e);
            return Collections.emptyList();
        }
    }

    @Override
    public void reindex(String type, Long id) {
        // TODO: 实现重建索引逻辑
        log.info("Reindexing {} with id: {}", type, id);
    }

    @Override
    public void reindexAll() {
        // TODO: 实现全量重建索引逻辑
        log.info("Reindexing all data...");
    }

    /**
     * 构建消息查询
     */
    private Query buildMessageQuery(SearchRequest request) {
        BoolQuery.Builder boolQuery = Query.of(q -> q.bool(b -> {
            // 关键词搜索
            if (StringUtils.hasText(request.getKeyword())) {
                b.must(Query.of(q2 -> q2.multiMatch(mm -> mm
                        .query(request.getKeyword())
                        .fields("content^3", "searchText^2", "senderName^1", "groupName^1")
                        .type(com.elastic.clients.elasticsearch._types.query_dsl.TextQueryType.BestFields)
                        .fuzziness("AUTO")
                        .operator(com.elastic.clients.elasticsearch._types.query_dsl.Operator.And)
                )));
            }

            // 用户ID过滤
            if (request.getUserId() != null) {
                b.must(Query.of(q2 -> q2.term(t -> t
                        .field("userId")
                        .value(request.getUserId())
                )));
            }

            // 会话ID过滤
            if (request.getConversationId() != null) {
                b.must(Query.of(q2 -> q2.term(t -> t
                        .field("conversationId")
                        .value(request.getConversationId())
                )));
            }

            // 发送者过滤
            if (request.getSenderId() != null) {
                b.must(Query.of(q2 -> q2.term(t -> t
                        .field("senderId")
                        .value(request.getSenderId())
                )));
            }

            // 消息类型过滤
            if (request.hasMessageTypeFilter()) {
                b.must(Query.of(q2 -> q2.terms(t -> t
                        .field("type")
                        .terms(ts -> ts.value(request.getMessageTypes().stream()
                                .map(v -> com.elastic.clients.json.JsonData.of(v))
                                .collect(Collectors.toList())))
                )));
            }

            // 时间范围过滤
            if (request.hasTimeRange()) {
                RangeQuery.Builder rangeQuery = RangeQuery.of(r -> {
                    if (request.getStartTime() != null) {
                        String startTime = LocalDateTime.ofInstant(
                                request.getStartTime().toInstant(),
                                java.time.ZoneId.systemDefault()
                        ).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                        r.gte(g -> g.stringValue(startTime));
                    }
                    if (request.getEndTime() != null) {
                        String endTime = LocalDateTime.ofInstant(
                                request.getEndTime().toInstant(),
                                java.time.ZoneId.systemDefault()
                        ).format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
                        r.lte(l -> l.stringValue(endTime));
                    }
                    return r.field("createdAt");
                });
                b.must(Query.of(q2 -> q2.range(rangeQuery.build())));
            }

            // 附件过滤
            if (request.getHasAttachment() != null) {
                if (request.getHasAttachment()) {
                    b.must(Query.of(q2 -> q2.exists(e -> e.field("attachments"))));
                } else {
                    b.mustNot(Query.of(q2 -> q2.exists(e -> e.field("attachments"))));
                }
            }

            // 地理位置搜索
            if (request.hasGeoSearch()) {
                SearchRequest.GeoSearch geo = request.getGeoSearch();
                b.must(Query.of(q2 -> q2.geoDistance(g -> g
                        .field("location")
                        .location(l -> l.latlon(ll -> ll
                                .lat(geo.getLat())
                                .lon(geo.getLon())
                        ))
                        .distance(d -> d.value(geo.getRadius().toString() + geo.getUnit()))
                )));
            }

            // 排除已撤回的消息
            b.mustNot(Query.of(q2 -> q2.term(t -> t
                    .field("recalled")
                    .value(true)
            )));

            return b;
        }));

        return Query.of(q -> q.bool(boolQuery.build()));
    }

    /**
     * 构建排序
     */
    private void buildSort(SearchRequest.Builder searchBuilder, SearchRequest request) {
        if ("weight".equals(request.getSortBy())) {
            // 自定义权重排序
            searchBuilder.sort(s -> s
                    .score(sc -> sc.order(
                            request.getSortDirection() == SearchRequest.SortDirection.ASC
                                    ? com.elastic.clients.elasticsearch._types.SortOrder.Asc
                                    : com.elastic.clients.elasticsearch._types.SortOrder.Desc
                    ))
            );
        } else {
            // 字段排序
            searchBuilder.sort(s -> s
                    .field(f -> f
                            .field(request.getSortBy())
                            .order(request.getSortDirection() == SearchRequest.SortDirection.ASC
                                    ? com.elastic.clients.elasticsearch._types.SortOrder.Asc
                                    : com.elastic.clients.elasticsearch._types.SortOrder.Desc)
                    )
            );
        }
    }

    /**
     * 构建聚合
     */
    private void buildAggregations(SearchRequest.Builder searchBuilder) {
        searchBuilder.aggregations("message_types", a -> a
                .terms(t -> t
                        .field("type")
                        .size(10)
                )
        );

        searchBuilder.aggregations("date_histogram", a -> a
                .dateHistogram(dh -> dh
                        .field("createdAt")
                        .calendarInterval(com.elastic.clients.elasticsearch._types.aggregations.CalendarInterval.Day)
                )
        );
    }

    /**
     * 设置高亮信息
     */
    private void setHighlightInfo(List<MessageDocument> documents, List<Hit<MessageDocument>> hits) {
        for (int i = 0; i < documents.size() && i < hits.size(); i++) {
            MessageDocument doc = documents.get(i);
            Hit<MessageDocument> hit = hits.get(i);

            if (hit.highlight() != null) {
                Map<String, List<String>> highlight = hit.highlight();
                if (highlight.containsKey("content")) {
                    doc.setHighlightContent(String.join("...", highlight.get("content")));
                }
            }
        }
    }

    /**
     * 处理聚合结果
     */
    private SearchResponse.Aggregations processAggregations(SearchResponse<MessageDocument> response) {
        SearchResponse.Aggregations aggregations = new SearchResponse.Aggregations();

        // TODO: 处理聚合结果
        return aggregations;
    }

    /**
     * 异步搜索
     */
    private CompletableFuture<SearchResponse<?>> searchMessagesAsync(SearchRequest request) {
        return CompletableFuture.supplyAsync(() -> searchMessagesSync(request));
    }

    /**
     * 更新热门搜索
     */
    private void updateHotSearch(String keyword) {
        if (!StringUtils.hasText(keyword)) {
            return;
        }

        try {
            if (redisTemplate != null) {
                redisTemplate.opsForZSet().incrementScore(HOT_SEARCH_KEY, keyword, 1);

                // 只保留前100个热门搜索
                redisTemplate.opsForZSet().removeRange(HOT_SEARCH_KEY, 0, -101);
                redisTemplate.expire(HOT_SEARCH_KEY, Duration.ofDays(7));
            }
        } catch (Exception e) {
            log.error("Failed to update hot search", e);
        }
    }
}