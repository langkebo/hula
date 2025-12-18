package com.luohuo.flex.im.domain.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;

import java.time.LocalDateTime;

/**
 * 消息搜索文档
 *
 * @author HuLa
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(indexName = "im_messages")
public class MessageDocument {

    @Id
    private String id;

    /**
     * 消息ID
     */
    @Field(type = FieldType.Long)
    private Long messageId;

    /**
     * 发送者ID
     */
    @Field(type = FieldType.Long)
    private Long senderId;

    /**
     * 发送者名称
     */
    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String senderName;

    /**
     * 接收者ID（私聊）
     */
    @Field(type = FieldType.Long)
    private Long receiverId;

    /**
     * 群组ID（群聊）
     */
    @Field(type = FieldType.Long)
    private Long groupId;

    /**
     * 消息内容
     */
    @Field(type = FieldType.Text, analyzer = "ik_max_word", searchAnalyzer = "ik_smart")
    private String content;

    /**
     * 消息类型
     */
    @Field(type = FieldType.Keyword)
    private String messageType;

    /**
     * 发送时间
     */
    @Field(type = FieldType.Date)
    private LocalDateTime sendTime;

    /**
     * 租户ID
     */
    @Field(type = FieldType.Long)
    private Long tenantId;

    /**
     * 是否已删除
     */
    @Field(type = FieldType.Boolean)
    private Boolean deleted;

    /**
     * 消息状态
     */
    @Field(type = FieldType.Keyword)
    private String status;

    /**
     * 消息扩展信息
     */
    @Field(type = FieldType.Object)
    private Object extra;
}