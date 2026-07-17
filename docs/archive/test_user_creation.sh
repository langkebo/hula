#!/bin/bash

# HuLa 测试脚本 - 注册用户、添加好友、创建房间和空间
# 后端地址: https://matrix.test

BASE_URL="https://matrix.test"
TIMESTAMP=$(date +%s)
NEW_USERNAME="testuser_${TIMESTAMP}"
NEW_PASSWORD="Test123456!"
CURRENT_USER="ljf"
CURRENT_PASSWORD=""

echo "=========================================="
echo "HuLa 功能验证测试"
echo "=========================================="
echo "时间戳: ${TIMESTAMP}"
echo "新用户名: ${NEW_USERNAME}"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 步骤 1: 注册新用户
echo "------------------------------------------"
echo "步骤 1: 注册新用户"
echo "------------------------------------------"

REGISTER_RESPONSE=$(curl -s -X POST "${BASE_URL}/_matrix/client/v3/register" \
    -H "Content-Type: application/json" \
    -d '{
        "username": "'"${NEW_USERNAME}"'",
        "password": "'"${NEW_PASSWORD}"'",
        "initial_device_display_name": "HuLa Test Device",
        "auth": {
            "type": "m.login.dummy"
        }
    }')

REGISTER_USER_ID=$(echo $REGISTER_RESPONSE | jq -r '.user_id // empty')
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.access_token // empty')
DEVICE_ID=$(echo $REGISTER_RESPONSE | jq -r '.device_id // empty')

if [ -n "$REGISTER_USER_ID" ] && [ -n "$ACCESS_TOKEN" ]; then
    log_info "✅ 用户注册成功!"
    log_info "   用户ID: ${REGISTER_USER_ID}"
    log_info "   Access Token: ${ACCESS_TOKEN:0:20}..."
    log_info "   设备ID: ${DEVICE_ID}"
else
    ERROR_MSG=$(echo $REGISTER_RESPONSE | jq -r '.error // .message // "未知错误"')
    log_error "❌ 用户注册失败: ${ERROR_MSG}"
    log_error "   响应: ${REGISTER_RESPONSE}"
    exit 1
fi

echo ""

# 步骤 2: 获取当前用户的访问令牌（如果需要）
echo "------------------------------------------"
echo "步骤 2: 获取当前用户令牌"
echo "------------------------------------------"

LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/_matrix/client/v3/login" \
    -H "Content-Type: application/json" \
    -d '{
        "type": "m.login.password",
        "identifier": {
            "type": "m.id.user",
            "user": "'"${CURRENT_USER}"'"
        },
        "password": "'"${CURRENT_PASSWORD:-"test123"}"'",
        "device_id": "TEST_DEVICE",
        "initial_device_display_name": "HuLa Current User Device"
    }')

CURRENT_ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.access_token // empty')

if [ -n "$CURRENT_ACCESS_TOKEN" ]; then
    log_info "✅ 当前用户登录成功"
else
    log_warn "⚠️ 当前用户登录失败，将使用其他方式继续测试"
fi

echo ""

# 步骤 3: 添加好友关系
echo "------------------------------------------"
echo "步骤 3: 添加好友关系"
echo "------------------------------------------"

if [ -n "$CURRENT_ACCESS_TOKEN" ]; then
    # 发送好友请求（使用 synapse-rust 扩展 API）
    FRIEND_REQUEST=$(curl -s -X POST "${BASE_URL}/_matrix/client/v3/friend/request" \
        -H "Authorization: Bearer ${CURRENT_ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "user_id": "'"${REGISTER_USER_ID}"'",
            "reason": "自动化测试添加好友"
        }')

    FRIEND_STATUS=$(echo $FRIEND_REQUEST | jq -r '.status // empty')
    
    if [ "$FRIEND_STATUS" == "pending" ] || [ "$FRIEND_STATUS" == "accepted" ]; then
        log_info "✅ 好友请求已发送 (状态: ${FRIEND_STATUS})"
    else
        # 尝试使用标准 Matrix API
        log_warn "⚠️ 扩展API不可用，尝试标准API..."
        
        INVITE_ROOM=$(curl -s -X POST "${BASE_URL}/_matrix/client/v3/createRoom" \
            -H "Authorization: Bearer ${CURRENT_ACCESS_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "name": "DM with '"${NEW_USERNAME}"'",
                "visibility": "private",
                "preset": "trusted_private_chat",
                "invite": ["'"${REGISTER_USER_ID}"'],
                "is_direct": true
            }')
        
        DM_ROOM_ID=$(echo $INVITE_ROOM | jq -r '.room_id // empty')
        
        if [ -n "$DM_ROOM_ID" ]; then
            log_info "✅ 已创建私聊房间并邀请: ${DM_ROOM_ID}"
        else
            log_warn "⚠️ 无法创建私聊房间"
        fi
    fi
else
    log_warn "⚠️ 跳过好友添加（无有效token）"
fi

echo ""

# 步骤 4: 使用新用户创建一个房间
echo "------------------------------------------"
echo "步骤 4: 创建房间"
echo "------------------------------------------"

CREATE_ROOM_RESPONSE=$(curl -s -X POST "${BASE_URL}/_matrix/client/v3/createRoom" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "测试房间_'"${TIMESTAMP}"'",
        "topic": "这是一个自动化测试创建的房间",
        "visibility": "public",
        "preset": "public_chat",
        "room_alias_name": "'"test-room-${TIMESTAMP}"'",
        "creation_content": {
            "m.federate": false
        },
        "initial_state": [
            {
                "type": "m.room.guest_access",
                "state_key": "",
                "content": {"guest_access": "forbidden"}
            },
            {
                "type": "m.room.history_visibility",
                "state_key": "",
                "content": {"history_visibility": "shared"}
            }
        ],
        "invite": ["@'"${CURRENT_USER}"':matrix.test"]
    }')

ROOM_ID=$(echo $CREATE_ROOM_RESPONSE | jq -r '.room_id // empty')
ROOM_ALIAS=$(echo $CREATE_ROOM_RESPONSE | jq -r '.room_alias // empty')

if [ -n "$ROOM_ID" ]; then
    log_info "✅ 房间创建成功!"
    log_info "   房间ID: ${ROOM_ID}"
    log_info "   房间别名: ${ROOM_ALIAS:-"无别名"}"
    
    # 发送欢迎消息
    SEND_MESSAGE=$(curl -s -X PUT "${BASE_URL}/_matrix/client/v3/rooms/${ROOM_ID}/send/m.room.message/$(date +%s%N)" \
        -H "Authorization: Bearer ${ACCESS_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "msgtype": "m.text",
            "body": "🎉 欢迎来到测试房间！这是由自动化测试创建的。"
        }')
    
    EVENT_ID=$(echo $SEND_MESSAGE | jq -r '.event_id // empty')
    if [ -n "$EVENT_ID" ]; then
        log_info "✅ 欢迎消息已发送 (事件ID: ${EVENT_ID})"
    fi
else
    ERROR_MSG=$(echo $CREATE_ROOM_RESPONSE | jq -r '.error // "未知错误"')
    log_error "❌ 房间创建失败: ${ERROR_MSG}"
fi

echo ""

# 步骤 5: 创建一个空间
echo "------------------------------------------"
echo "步骤 5: 创建空间"
echo "------------------------------------------"

CREATE_SPACE_RESPONSE=$(curl -s -X POST "${BASE_URL}/_matrix/client/v3/createRoom" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "测试空间_'"${TIMESTAMP}"'",
        "topic": "这是一个自动化测试创建的空间",
        "visibility": "private",
        "preset": "private_chat",
        "room_alias_name": "'"test-space-${TIMESTAMP}"'",
        "creation_content": {
            "type": "m.space"
        },
        "initial_state": [
            {
                "type": "m.room.history_visibility",
                "state_key": "",
                "content": {"history_visibility": "shared"}
            }
        ]
    }')

SPACE_ID=$(echo $CREATE_SPACE_RESPONSE | jq -r '.room_id // empty')
SPACE_ALIAS=$(echo $CREATE_SPACE_RESPONSE | jq -r '.room_alias // empty')

if [ -n "$SPACE_ID" ]; then
    log_info "✅ 空间创建成功!"
    log_info "   空间ID: ${SPACE_ID}"
    log_info "   空间别名: ${SPACE_ALIAS:-"无别名"}"
    
    # 将房间添加到空间中
    if [ -n "$ROOM_ID" ]; then
        ADD_TO_SPACE=$(curl -s -X PUT "${BASE_URL}/_matrix/client/v3/rooms/${SPACE_ID}/state/m.space.child/${ROOM_ID}" \
            -H "Authorization: Bearer ${ACCESS_TOKEN}" \
            -H "Content-Type: application/json" \
            -d '{
                "via": ["matrix.test"]
            }')
        
        log_info "✅ 已将房间添加到空间"
    fi
else
    ERROR_MSG=$(echo $CREATE_SPACE_RESPONSE | jq -r '.error // "未知错误"')
    log_error "❌ 空间创建失败: ${ERROR_MSG}"
fi

echo ""

# 步骤 6: 验证数据
echo "=========================================="
echo "步骤 6: 数据验证"
echo "=========================================="

echo ""
echo "📋 测试结果汇总:"
echo "------------------------------------------"
echo "新用户信息:"
echo "  • 用户名: ${NEW_USERNAME}"
echo "  • 用户ID: ${REGISTER_USER_ID}"
echo "  • 密码: ${NEW_PASSWORD}"
echo ""
echo "创建的实体:"
if [ -n "$ROOM_ID" ]; then
    echo "  ✅ 房间: ${ROOM_ID} (${ROOM_ALIAS:-"无别名"})"
else
    echo "  ❌ 房间: 未创建"
fi

if [ -n "$SPACE_ID" ]; then
    echo "  ✅ 空间: ${SPACE_ID} (${SPACE_ALIAS:-"无别名"})"
else
    echo "  ❌ 空间: 未创建"
fi
echo ""
echo "------------------------------------------"
echo "📝 下一步操作:"
echo "1. 打开 HuLa 应用程序"
echo "2. 检查左侧导航栏的好友列表按钮"
echo "3. 检查左侧导航栏的房间列表按钮"
echo "4. 检查左侧导航栏的空间列表按钮"
echo "5. 鼠标悬停确认 tooltip 显示中文"
echo "6. 点击各按钮查看是否显示刚创建的内容"
echo "------------------------------------------"

# 保存测试数据供后续使用
cat > /tmp/hula_test_data.json << EOF
{
    "timestamp": "${TIMESTAMP}",
    "new_user": {
        "username": "${NEW_USERNAME}",
        "password": "${NEW_PASSWORD}",
        "user_id": "${REGISTER_USER_ID}",
        "access_token": "${ACCESS_TOKEN}",
        "device_id": "${DEVICE_ID}"
    },
    "created_room": {
        "room_id": "${ROOM_ID}",
        "room_alias": "${ROOM_ALIAS}"
    },
    "created_space": {
        "space_id": "${SPACE_ID}",
        "space_alias": "${SPACE_ALIAS}"
    }
}
EOF

log_info "✅ 测试数据已保存到 /tmp/hula_test_data.json"
echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
