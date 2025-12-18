package com.luohuo.flex.im.domain.constants;

/**
 * 消息常量
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
public interface MessageConstants {

    /**
     * 消息最大长度
     */
    int MAX_MESSAGE_LENGTH = 10000;

    /**
     * 文件最大大小（100MB）
     */
    long MAX_FILE_SIZE = 100 * 1024 * 1024L;

    /**
     * 图片最大大小（10MB）
     */
    long MAX_IMAGE_SIZE = 10 * 1024 * 1024L;

    /**
     * 语音最大大小（20MB）
     */
    long MAX_VOICE_SIZE = 20 * 1024 * 1024L;

    /**
     * 视频最大大小（200MB）
     */
    long MAX_VIDEO_SIZE = 200 * 1024 * 1024L;

    /**
     * 撤回消息时限（2分钟）
     */
    long RECALL_TIMEOUT = 2 * 60 * 1000L;

    /**
     * 消息类型-文本
     */
    int MESSAGE_TYPE_TEXT = 1;

    /**
     * 消息类型-图片
     */
    int MESSAGE_TYPE_IMAGE = 2;

    /**
     * 消息类型-语音
     */
    int MESSAGE_TYPE_VOICE = 3;

    /**
     * 消息类型-视频
     */
    int MESSAGE_TYPE_VIDEO = 4;

    /**
     * 消息类型-文件
     */
    int MESSAGE_TYPE_FILE = 5;

    /**
     * 消息类型-系统
     */
    int MESSAGE_TYPE_SYSTEM = 6;

    /**
     * 消息状态-发送中
     */
    int MESSAGE_STATUS_SENDING = 1;

    /**
     * 消息状态-发送成功
     */
    int MESSAGE_STATUS_SEND_SUCCESS = 2;

    /**
     * 消息状态-发送失败
     */
    int MESSAGE_STATUS_SEND_FAILED = 3;

    /**
     * 消息状态-已读
     */
    int MESSAGE_STATUS_READ = 4;

    /**
     * 消息状态-已撤回
     */
    int MESSAGE_STATUS_RECALL = 5;

    /**
     * 消息状态-已删除
     */
    int MESSAGE_STATUS_DELETED = 6;

    /**
     * 消息状态-阅后即焚
     */
    int MESSAGE_STATUS_BURN_AFTER_READ = 7;

    /**
     * 会话类型-单聊
     */
    int CONVERSATION_TYPE_PRIVATE = 1;

    /**
     * 会话类型-群聊
     */
    int CONVERSATION_TYPE_GROUP = 2;

    /**
     * 加密类型-不加密
     */
    int ENCRYPT_TYPE_NONE = 0;

    /**
     * 加密类型-端到端加密
     */
    int ENCRYPT_TYPE_E2EE = 1;
}