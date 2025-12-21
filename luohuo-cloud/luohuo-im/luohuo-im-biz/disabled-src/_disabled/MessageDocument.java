package com.luohuo.flex.im.search.document;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import java.io.Serializable;
import java.util.Date;
import java.util.List;
import java.util.Map;

/**
 * 消息搜索文档
 * 用于Elasticsearch索引的消息文档结构
 *
 * @author HuLa
 */
@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class MessageDocument implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * 消息ID
     */
    private Long id;

    /**
     * 会话ID
     */
    private Long conversationId;

    /**
     * 发送者ID
     */
    private Long senderId;

    /**
     * 发送者名称
     */
    private String senderName;

    /**
     * 接收者ID（私聊时）
     */
    private Long receiverId;

    /**
     * 接收者名称
     */
    private String receiverName;

    /**
     * 消息内容
     */
    private String content;

    /**
     * 消息类型
     */
    private String type;

    /**
     * 消息状态
     */
    private Integer status;

    /**
     * 是否已撤回
     */
    private Boolean recalled;

    /**
     * 撤回时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date recallTime;

    /**
     * 附件信息（JSON格式）
     */
    private List<Map<String, Object>> attachments;

    /**
     * 消息属性（JSON格式）
     */
    private Map<String, Object> attributes;

    /**
     * 消息序号
     */
    private Long sequence;

    /**
     * 引用消息ID
     */
    private Long quoteMessageId;

    /**
     * 引用消息内容
     */
    private String quoteContent;

    /**
     * 搜索文本（用于全文搜索）
     */
    private String searchText;

    /**
     * 搜索权重
     */
    private Integer weight;

    /**
     * 消息方向
     */
    private String direction; // sent/received

    /**
     * 用户ID（用于用户维度搜索）
     */
    private Long userId;

    /**
     * 创建时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date createdAt;

    /**
     * 更新时间
     */
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private Date updatedAt;

    /**
     * 群组ID（如果是群聊）
     */
    private Long groupId;

    /**
     * 群组名称
     */
    private String groupName;

    /**
     * 消息标签
     */
    private List<String> tags;

    /**
     * 优先级
     */
    private Integer priority;

    /**
     * 地理位置（如果有）
     */
    private GeoPoint location;

    /**
     * 地理位置类
     */
    @Data
    public static class GeoPoint {
        private double lat;
        private double lon;
        private String address;
    }

    /**
     * 添加标签
     */
    public void addTag(String tag) {
        if (this.tags == null) {
            this.tags = new java.util.ArrayList<>();
        }
        this.tags.add(tag);
    }

    /**
     * 添加属性
     */
    public void addAttribute(String key, Object value) {
        if (this.attributes == null) {
            this.attributes = new java.util.HashMap<>();
        }
        this.attributes.put(key, value);
    }

    /**
     * 获取附件类型列表
     */
    public List<String> getAttachmentTypes() {
        if (attachments == null || attachments.isEmpty()) {
            return new java.util.ArrayList<>();
        }
        return attachments.stream()
                .map(att -> (String) att.get("type"))
                .filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toList());
    }

    /**
     * 是否包含图片
     */
    public boolean hasImage() {
        return getAttachmentTypes().contains("IMAGE");
    }

    /**
     * 是否包含视频
     */
    public boolean hasVideo() {
        return getAttachmentTypes().contains("VIDEO");
    }

    /**
     * 是否包含文件
     */
    public boolean hasFile() {
        return getAttachmentTypes().contains("FILE");
    }

    /**
     * 是否包含语音
     */
    public boolean hasAudio() {
        return getAttachmentTypes().contains("AUDIO");
    }
}