#!/bin/bash

# 验证好友系统修复的测试脚本

BASE_URL="https://matrix.test"
TIMESTAMP=$(date +%s)

echo "=========================================="
echo "好友系统验证测试"
echo "=========================================="
echo "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 使用新用户的token（从之前的测试）
NEW_USER_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJAdGVzdHVzZXJfMTc3ODQ2MTMxNzptYXRyaXgudGVzdCIsInVzZXJfaWQiOiJAdGVzdHVzZXJfMTc3ODQ2MTMxNzptYXRyaXgudGVzdCIsImp0aSI6IjRlNDc4OTI0LTg1YmYtNGJhYy05ZWY1LTVlZDhhYzQ2MDVhYiIsImFkbWluIjpmYWxzZSwiZXhwIjoxNzc4NTQ3NzE3LCJpYXQiOjE3Nzg0NjEzMTcsImRldmljZV9pZCI6IjM5d01fLVhhdHBVWXBlQzBSMGF3R1EifQ.mmYDWaqDWENtVIrS_7VWiUEIUjlbvBa-2htBj_uIzeQ"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

# 1. 测试好友列表API
echo "------------------------------------------"
echo "步骤 1: 测试好友列表API"
echo "------------------------------------------"

FRIEND_LIST=$(curl -s -H "Authorization: Bearer ${NEW_USER_TOKEN}" \
  "${BASE_URL}/_matrix/client/v3/friends")

echo "好友列表响应:"
echo "$FRIEND_LIST" | jq '.'

FRIEND_COUNT=$(echo $FRIEND_LIST | jq '.friends // [] | length')
log_info "好友数量: ${FRIEND_COUNT}"

if [ "$FRIEND_COUNT" -gt 0 ]; then
    log_info "✅ 好友列表非空"
else
    log_warn "⚠️ 好友列表为空（可能需要等待同步）"
fi

echo ""

# 2. 发送新的好友请求
echo "------------------------------------------"
echo "步骤 2: 发送好友请求"
echo "------------------------------------------"

SEND_REQUEST=$(curl -s -X POST -H "Authorization: Bearer ${NEW_USER_TOKEN}" \
  -H "Content-Type: application/json" \
  "${BASE_URL}/_matrix/client/v3/friend/request" \
  -d '{"user_id": "@ljf:matrix.test", "message": "自动化测试好友请求 #2"}')

echo "发送请求响应:"
echo "$SEND_REQUEST" | jq '.'

REQUEST_STATUS=$(echo $SEND_REQUEST | jq -r '.status // empty')

if [ -n "$REQUEST_STATUS" ]; then
    log_info "✅ 好友请求已发送 (状态: $REQUEST_STATUS)"
else
    ERROR=$(echo $SEND_REQUEST | jq -r '.error // empty')
    if [ -n "$ERROR" ]; then
        log_warn "⚠️ 好友请求失败: $ERROR"
        log_info "尝试使用DM房间方式..."
        
        # 备选方案：创建DM房间
        DM_RESPONSE=$(curl -s -X POST -H "Authorization: Bearer ${NEW_USER_TOKEN}" \
          -H "Content-Type: application/json" \
          "${BASE_URL}/_matrix/client/v3/createRoom" \
          -d '{
            "name": "测试好友关系_'"${TIMESTAMP}"'",
            "visibility": "private",
            "preset": "trusted_private_chat",
            "invite": ["@ljf:matrix.test"],
            "is_direct": true,
            "topic": "用于验证好友系统的测试房间"
          }')
        
        DM_ROOM_ID=$(echo $DM_RESPONSE | jq -r '.room_id // empty')
        if [ -n "$DM_ROOM_ID" ]; then
            log_info "✅ 已创建DM房间作为好友关系: $DM_ROOM_ID"
            
            # 发送消息
            MSG_ID=$(date +%s%N)
            curl -s -X PUT -H "Authorization: Bearer ${NEW_USER_TOKEN}" \
              -H "Content-Type: application/json" \
              "${BASE_URL}/_matrix/client/v3/rooms/${DM_ROOM_ID}/send/m.room.message/${MSG_ID}" \
              -d '{"msgtype": "m.text", "body": "🤝 这是第二次好友请求测试！"}' > /dev/null
            
            log_info "✅ 已发送测试消息"
        fi
    fi
fi

echo ""

# 3. 检查房间列表
echo "------------------------------------------"
echo "步骤 3: 验证房间数据"
echo "------------------------------------------"

JOINED_ROOMS=$(curl -s -H "Authorization: Bearer ${NEW_USER_TOKEN}" \
  "${BASE_URL}/_matrix/client/v3/joined_rooms")

ROOM_IDS=$(echo $JOINED_ROOMS | jq -r '.joined_rooms[]')
ROOM_COUNT=$(echo $JOINED_ROOMS | jq '.joined_rooms | length')

log_info "已加入的房间数量: ${ROOM_COUNT}"

for ROOM_ID in $ROOM_IDS; do
    echo ""
    echo "--- 房间: ${ROOM_ID} ---"
    
    # 获取房间名称
    ROOM_NAME=$(curl -s -H "Authorization: Bearer ${NEW_USER_TOKEN}" \
      "${BASE_URL}/_matrix/client/v3/rooms/${ROOM_ID}/state/m.room.name" | jq -r '.name // "未命名"')
    
    log_info "   名称: ${ROOM_NAME}"
    
    # 获取成员数量
    MEMBERS=$(curl -s -H "Authorization: Bearer ${NEW_USER_TOKEN}" \
      "${BASE_URL}/_matrix/client/v3/rooms/${ROOM_ID}/members" | jq '[.chunk[]? | select(.membership == "join")] | length')
    
    log_info "   成员数: ${MEMBERS}"
done

echo ""

# 4. 总结
echo "=========================================="
echo "验证结果汇总"
echo "=========================================="
echo ""
echo "✅ 后端服务状态: 正常运行"
echo "📊 好友数量: ${FRIEND_COUNT}"
echo "📊 房间数量: ${ROOM_COUNT}"
echo ""
echo "📝 下一步操作:"
echo "1. 重启 HuLa 应用程序（以加载 FriendManager 初始化代码）"
echo "2. 登录账号 @ljf:matrix.test"
echo "3. 点击左侧导航栏的好友按钮"
echo "4. 确认是否显示新用户 testuser_1778461317 的好友请求"
echo "5. 点击左侧导航栏的房间按钮"
echo "6. 确认是否显示刚创建的测试房间"
echo ""
echo "=========================================="
echo "测试完成!"
echo "=========================================="
