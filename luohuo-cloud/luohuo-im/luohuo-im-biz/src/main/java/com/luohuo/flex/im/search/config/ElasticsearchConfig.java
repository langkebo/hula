package com.luohuo.flex.im.search.config;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.analysis.*;
import co.elastic.clients.elasticsearch.indices.CreateIndexRequest;
import co.elastic.clients.elasticsearch.indices.ExistsRequest;
import co.elastic.clients.elasticsearch.indices.PutMappingRequest;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.auth.AuthScope;
import org.apache.http.HttpHost;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.client.CredentialsProvider;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestClientBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.repository.config.EnableElasticsearchRepositories;

import jakarta.annotation.PostConstruct;
import java.io.StringReader;
import java.util.HashMap;
import java.util.Map;

/**
 * Elasticsearch配置
 *
 * @author HuLa
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
@EnableElasticsearchRepositories(basePackages = "com.luohuo.flex.im.search.repository")
@ConfigurationProperties(prefix = "hula.elasticsearch")
public class ElasticsearchConfig {

    @Value("${hula.elasticsearch.hosts:localhost:9200}")
    private String hosts;

    @Value("${hula.elasticsearch.username:}")
    private String username;

    @Value("${hula.elasticsearch.password:}")
    private String password;

    @Value("${hula.elasticsearch.connection.timeout:30s}")
    private String connectionTimeout;

    @Value("${hula.elasticsearch.socket.timeout:30s}")
    private String socketTimeout;

    @Value("${hula.elasticsearch.index.message:hula_message}")
    private String messageIndex;

    @Value("${hula.elasticsearch.index.conversation:hula_conversation}")
    private String conversationIndex;

    @Value("${hula.elasticsearch.index.user:hula_user}")
    private String userIndex;

    private ElasticsearchClient elasticsearchClient;

    /**
     * 创建Elasticsearch客户端
     */
    @Bean
    public ElasticsearchClient elasticsearchClient() {
        // 解析主机配置
        String[] hostArray = hosts.split(",");
        HttpHost[] httpHosts = new HttpHost[hostArray.length];
        for (int i = 0; i < hostArray.length; i++) {
            String[] hostPort = hostArray[i].trim().split(":");
            httpHosts[i] = new HttpHost(hostPort[0],
                hostPort.length > 1 ? Integer.parseInt(hostPort[1]) : 9200, "http");
        }

        int connectTimeoutMs = (int) java.time.Duration.parse("PT" + connectionTimeout.toUpperCase()).toMillis();
        int socketTimeoutMs = (int) java.time.Duration.parse("PT" + socketTimeout.toUpperCase()).toMillis();

        // 创建RestClient
        RestClientBuilder builder = RestClient.builder(httpHosts)
                .setRequestConfigCallback(requestConfigBuilder ->
                    requestConfigBuilder
                        .setConnectTimeout(connectTimeoutMs)
                        .setSocketTimeout(socketTimeoutMs));

        // 添加认证信息
        if (username != null && !username.isEmpty()) {
            CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
            credentialsProvider.setCredentials(AuthScope.ANY, new UsernamePasswordCredentials(username, password));
            builder.setHttpClientConfigCallback(httpClientBuilder ->
                    httpClientBuilder.setDefaultCredentialsProvider(credentialsProvider));
        }

        RestClient restClient = builder.build();

        // 创建传输层
        ElasticsearchTransport transport = new RestClientTransport(
                restClient, new JacksonJsonpMapper());

        // 创建客户端
        return new ElasticsearchClient(transport);
    }

    /**
     * 初始化索引
     */
    @PostConstruct
    public void initIndices() {
        try {
            log.info("Initializing Elasticsearch indices...");

            // 创建消息索引
            createMessageIndex();

            // 创建会话索引
            createConversationIndex();

            // 创建用户索引
            createUserIndex();

            log.info("Elasticsearch indices initialized successfully");
        } catch (Exception e) {
            log.error("Failed to initialize Elasticsearch indices", e);
        }
    }

    /**
     * 创建消息索引
     */
    private void createMessageIndex() {
        try {
            if (!indexExists(messageIndex)) {
                log.info("Creating message index: {}", messageIndex);

                String mapping = """
                {
                  "settings": {
                    "number_of_shards": 3,
                    "number_of_replicas": 1,
                    "max_result_window": 50000,
                    "analysis": {
                      "analyzer": {
                        "text_analyzer": {
                          "type": "custom",
                          "tokenizer": "ik_max_word",
                          "filter": [
                            "lowercase",
                            "stop",
                            "synonym_filter"
                          ]
                        },
                        "search_analyzer": {
                          "type": "custom",
                          "tokenizer": "ik_smart",
                          "filter": [
                            "lowercase",
                            "stop"
                          ]
                        }
                      },
                      "filter": {
                        "synonym_filter": {
                          "type": "synonym",
                          "synonyms": [
                            "hi,hello",
                            "bye,goodbye",
                            "图片,image,photo",
                            "视频,video"
                          ]
                        }
                      }
                    }
                  },
                  "mappings": {
                    "properties": {
                      "id": {
                        "type": "long"
                      },
                      "conversationId": {
                        "type": "long"
                      },
                      "senderId": {
                        "type": "long"
                      },
                      "senderName": {
                        "type": "text",
                        "analyzer": "keyword",
                        "fields": {
                          "search": {
                            "type": "text",
                            "analyzer": "text_analyzer"
                          }
                        }
                      },
                      "receiverId": {
                        "type": "long"
                      },
                      "receiverName": {
                        "type": "text",
                        "analyzer": "keyword"
                      },
                      "content": {
                        "type": "text",
                        "analyzer": "text_analyzer",
                        "fields": {
                          "keyword": {
                            "type": "keyword"
                          }
                        }
                      },
                      "searchText": {
                        "type": "text",
                        "analyzer": "text_analyzer"
                      },
                      "type": {
                        "type": "keyword"
                      },
                      "status": {
                        "type": "integer"
                      },
                      "recalled": {
                        "type": "boolean"
                      },
                      "recallTime": {
                        "type": "date",
                        "format": "yyyy-MM-dd HH:mm:ss"
                      },
                      "attachments": {
                        "type": "nested",
                        "properties": {
                          "type": {
                            "type": "keyword"
                          },
                          "name": {
                            "type": "text"
                          },
                          "url": {
                            "type": "keyword"
                          },
                          "size": {
                            "type": "long"
                          }
                        }
                      },
                      "attributes": {
                        "type": "object",
                        "dynamic": true
                      },
                      "sequence": {
                        "type": "long"
                      },
                      "quoteMessageId": {
                        "type": "long"
                      },
                      "quoteContent": {
                        "type": "text",
                        "analyzer": "text_analyzer"
                      },
                      "weight": {
                        "type": "integer"
                      },
                      "direction": {
                        "type": "keyword"
                      },
                      "userId": {
                        "type": "long"
                      },
                      "createdAt": {
                        "type": "date",
                        "format": "yyyy-MM-dd HH:mm:ss"
                      },
                      "updatedAt": {
                        "type": "date",
                        "format": "yyyy-MM-dd HH:mm:ss"
                      },
                      "groupId": {
                        "type": "long"
                      },
                      "groupName": {
                        "type": "text",
                        "analyzer": "keyword",
                        "fields": {
                          "search": {
                            "type": "text",
                            "analyzer": "text_analyzer"
                          }
                        }
                      },
                      "tags": {
                        "type": "keyword"
                      },
                      "priority": {
                        "type": "integer"
                      },
                      "location": {
                        "type": "geo_point"
                      },
                      "attachmentTypes": {
                        "type": "keyword"
                      }
                    }
                  }
                }
                """;

                CreateIndexRequest request = CreateIndexRequest.of(i -> i
                        .index(messageIndex)
                        .withJson(new StringReader(mapping))
                );

                elasticsearchClient().indices().create(request);
                log.info("Message index created successfully: {}", messageIndex);
            } else {
                log.info("Message index already exists: {}", messageIndex);
            }
        } catch (Exception e) {
            log.error("Failed to create message index", e);
            throw new RuntimeException("Failed to create message index", e);
        }
    }

    /**
     * 创建会话索引
     */
    private void createConversationIndex() {
        try {
            if (!indexExists(conversationIndex)) {
                log.info("Creating conversation index: {}", conversationIndex);

                String mapping = """
                {
                  "settings": {
                    "number_of_shards": 2,
                    "number_of_replicas": 1
                  },
                  "mappings": {
                    "properties": {
                      "id": {
                        "type": "long"
                      },
                      "name": {
                        "type": "text",
                        "analyzer": "text_analyzer",
                        "fields": {
                          "keyword": {
                            "type": "keyword"
                          }
                        }
                      },
                      "type": {
                        "type": "keyword"
                      },
                      "memberIds": {
                        "type": "keyword"
                      },
                      "memberCount": {
                        "type": "integer"
                      },
                      "lastMessageId": {
                        "type": "long"
                      },
                      "lastMessageContent": {
                        "type": "text",
                        "analyzer": "text_analyzer"
                      },
                      "lastMessageTime": {
                        "type": "date",
                        "format": "yyyy-MM-dd HH:mm:ss"
                      },
                      "messageCount": {
                        "type": "long"
                      },
                      "unreadCount": {
                        "type": "object",
                        "properties": {
                          "userId": {
                            "type": "long"
                          },
                          "count": {
                            "type": "integer"
                          }
                        }
                      },
                      "isActive": {
                        "type": "boolean"
                      },
                      "createdAt": {
                        "type": "date",
                        "format": "yyyy-MM-dd HH:mm:ss"
                      },
                      "updatedAt": {
                        "type": "date",
                        "format": "yyyy-MM-dd HH:mm:ss"
                      }
                    }
                  }
                }
                """;

                CreateIndexRequest request = CreateIndexRequest.of(i -> i
                        .index(conversationIndex)
                        .withJson(new StringReader(mapping))
                );

                elasticsearchClient().indices().create(request);
                log.info("Conversation index created successfully: {}", conversationIndex);
            }
        } catch (Exception e) {
            log.error("Failed to create conversation index", e);
        }
    }

    /**
     * 创建用户索引
     */
    private void createUserIndex() {
        try {
            if (!indexExists(userIndex)) {
                log.info("Creating user index: {}", userIndex);

                String mapping = """
                {
                  "settings": {
                    "number_of_shards": 2,
                    "number_of_replicas": 1
                  },
                  "mappings": {
                    "properties": {
                      "id": {
                        "type": "long"
                      },
                      "username": {
                        "type": "text",
                        "analyzer": "keyword",
                        "fields": {
                          "search": {
                            "type": "text",
                            "analyzer": "text_analyzer"
                          }
                        }
                      },
                      "nickname": {
                        "type": "text",
                        "analyzer": "text_analyzer",
                        "fields": {
                          "keyword": {
                            "type": "keyword"
                          }
                        }
                      },
                      "avatar": {
                        "type": "keyword"
                      },
                      "status": {
                        "type": "keyword"
                      },
                      "lastActiveTime": {
                        "type": "date",
                        "format": "yyyy-MM-dd HH:mm:ss"
                      },
                      "deviceCount": {
                        "type": "integer"
                      },
                      "conversationCount": {
                        "type": "integer"
                      },
                      "messageCount": {
                        "type": "long"
                      },
                      "tags": {
                        "type": "keyword"
                      },
                      "profile": {
                        "type": "object",
                        "properties": {
                          "bio": {
                            "type": "text",
                            "analyzer": "text_analyzer"
                          },
                          "location": {
                            "type": "text"
                          },
                          "website": {
                            "type": "keyword"
                          }
                        }
                      },
                      "createdAt": {
                        "type": "date",
                        "format": "yyyy-MM-dd HH:mm:ss"
                      },
                      "updatedAt": {
                        "type": "date",
                        "format": "yyyy-MM-dd HH:mm:ss"
                      }
                    }
                  }
                }
                """;

                CreateIndexRequest request = CreateIndexRequest.of(i -> i
                        .index(userIndex)
                        .withJson(new StringReader(mapping))
                );

                elasticsearchClient().indices().create(request);
                log.info("User index created successfully: {}", userIndex);
            }
        } catch (Exception e) {
            log.error("Failed to create user index", e);
        }
    }

    /**
     * 检查索引是否存在
     */
    private boolean indexExists(String indexName) {
        try {
            ExistsRequest request = ExistsRequest.of(e -> e.index(indexName));
            return elasticsearchClient().indices().exists(request).value();
        } catch (Exception e) {
            log.error("Failed to check index existence: {}", indexName, e);
            return false;
        }
    }

    /**
     * 获取消息索引名称
     */
    public String getMessageIndex() {
        return messageIndex;
    }

    /**
     * 获取会话索引名称
     */
    public String getConversationIndex() {
        return conversationIndex;
    }

    /**
     * 获取用户索引名称
     */
    public String getUserIndex() {
        return userIndex;
    }
}
