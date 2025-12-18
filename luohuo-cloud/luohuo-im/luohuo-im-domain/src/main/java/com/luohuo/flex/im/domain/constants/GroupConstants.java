package com.luohuo.flex.im.domain.constants;

/**
 * 群组常量
 *
 * @author HuLa Team
 * @since 2025-12-12
 */
public interface GroupConstants {

    /**
     * 群组最大成员数（普通群）
     */
    int MAX_GROUP_MEMBERS_NORMAL = 200;

    /**
     * 群组最大成员数（企业群）
     */
    int MAX_GROUP_MEMBERS_ENTERPRISE = 2000;

    /**
     * 群名最大长度
     */
    int MAX_GROUP_NAME_LENGTH = 50;

    /**
     * 群描述最大长度
     */
    int MAX_GROUP_DESC_LENGTH = 200;

    /**
     * 群组类型-普通群
     */
    int GROUP_TYPE_NORMAL = 1;

    /**
     * 群组类型-企业群
     */
    int GROUP_TYPE_ENTERPRISE = 2;

    /**
     * 群组状态-正常
     */
    int GROUP_STATUS_NORMAL = 1;

    /**
     * 群组状态-解散
     */
    int GROUP_STATUS_DISSOLVED = 2;

    /**
     * 加群方式-自由加入
     */
    int JOIN_TYPE_FREE = 1;

    /**
     * 加群方式-需要验证
     */
    int JOIN_TYPE_VERIFY = 2;

    /**
     * 加群方式-禁止加入
     */
    int JOIN_TYPE_FORBIDDEN = 3;

    /**
     * 成员角色-普通成员
     */
    int MEMBER_ROLE_MEMBER = 1;

    /**
     * 成员角色-管理员
     */
    int MEMBER_ROLE_ADMIN = 2;

    /**
     * 成员角色-群主
     */
    int MEMBER_ROLE_OWNER = 3;

    /**
     * 成员状态-正常
     */
    int MEMBER_STATUS_NORMAL = 1;

    /**
     * 成员状态-禁言
     */
    int MEMBER_STATUS_MUTED = 2;

    /**
     * 成员状态-踢出
     */
    int MEMBER_STATUS_KICKED = 3;

    /**
     * 成员状态-已退出
     */
    int MEMBER_STATUS_LEFT = 4;
}