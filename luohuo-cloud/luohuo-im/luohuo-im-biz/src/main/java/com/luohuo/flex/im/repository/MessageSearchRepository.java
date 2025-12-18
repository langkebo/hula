package com.luohuo.flex.im.repository;

import com.luohuo.flex.im.domain.document.MessageDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.annotations.Query;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 消息搜索Repository
 *
 * @author HuLa
 */
@Repository
public interface MessageSearchRepository extends ElasticsearchRepository<MessageDocument, String> {

    /**
     * 根据用户ID搜索消息
     */
    Page<MessageDocument> findBySenderIdOrReceiverIdAndDeletedFalseAndSendTimeBetween(
            Long senderId, Long receiverId, LocalDateTime startTime, LocalDateTime endTime, Pageable pageable);

    /**
     * 根据群组ID搜索消息
     */
    Page<MessageDocument> findByGroupIdAndDeletedFalseAndSendTimeBetween(
            Long groupId, LocalDateTime startTime, LocalDateTime endTime, Pageable pageable);

    /**
     * 全文搜索消息内容
     */
    @Query("""
            {
              "bool": {
                "must": [
                  {
                    "bool": {
                      "should": [
                        { "term": { "senderId": ?0 } },
                        { "term": { "receiverId": ?0 } },
                        { "term": { "groupId": ?1 } }
                      ]
                    }
                  },
                  {
                    "bool": {
                      "must": [
                        { "term": { "deleted": false } },
                        {
                          "bool": {
                            "must": [
                              {
                                "bool": {
                                  "should": [
                                    { "match": { "content": ?2 } },
                                    { "match": { "senderName": ?2 } }
                                  ]
                                }
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ],
                "filter": [
                  {
                    "range": {
                      "sendTime": {
                        "gte": ?3,
                        "lte": ?4
                      }
                    }
                  }
                ]
              }
            }
            """)
    Page<MessageDocument> searchMessages(Long userId, Long groupId, String keyword,
                                         LocalDateTime startTime, LocalDateTime endTime, Pageable pageable);

    /**
     * 搜索用户相关的所有消息
     */
    @Query("""
            {
              "bool": {
                "must": [
                  {
                    "bool": {
                      "should": [
                        { "term": { "senderId": ?0 } },
                        { "term": { "receiverId": ?0 } },
                        { "terms": { "groupId": ?1 } }
                      ]
                    }
                  },
                  { "term": { "deleted": false } }
                ],
                "filter": [
                  {
                    "range": {
                      "sendTime": {
                        "gte": ?2,
                        "lte": ?3
                      }
                    }
                  }
                ]
              }
            }
            """)
    Page<MessageDocument> searchUserMessages(Long userId, List<Long> groupIds,
                                             LocalDateTime startTime, LocalDateTime endTime, Pageable pageable);
}