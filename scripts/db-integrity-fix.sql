-- 数据库完整性修复脚本
-- 创建日期: 2025-12-20
-- 描述: 修复数据库中可能的数据完整性和重复问题

-- ==================================================
-- 1. 消息标记表防重复
-- ==================================================
-- 为 im_message_mark 表添加复合唯一索引，防止用户重复点赞/举报
-- 同一用户对同一消息的同一类型标记只能有一条记录
ALTER TABLE `im_message_mark`
ADD UNIQUE INDEX `uk_msg_uid_type`(`msg_id` ASC, `uid` ASC, `type` ASC)
COMMENT '防止用户对同一消息重复标记';

-- ==================================================
-- 2. 用户申请表防重复
-- ==================================================
-- 为 im_user_apply 表添加复合唯一索引，防止重复申请
-- 同一用户对同一对象的同一类型申请只能有一条有效记录
ALTER TABLE `im_user_apply`
ADD UNIQUE INDEX `uk_uid_target_type_status`(`uid` ASC, `target_id` ASC, `apply_type` ASC, `status` ASC)
COMMENT '防止用户重复申请';

-- ==================================================
-- 3. 好友关系表防重复
-- ==================================================
-- 确保好友关系表中没有重复的好友关系
-- room_id 和 room_id 1 已经是联合唯一索引，无需额外添加

-- ==================================================
-- 4. 检查并清理重复数据（如果需要）
-- ==================================================

-- 清理消息标记表中的重复数据（保留最早创建的记录）
DELETE m1 FROM `im_message_mark` m1
INNER JOIN `im_message_mark` m2
WHERE m1.id > m2.id
AND m1.msg_id = m2.msg_id
AND m1.uid = m2.uid
AND m1.type = m2.type;

-- 清理用户申请表中的重复数据（保留最早创建的记录）
DELETE a1 FROM `im_user_apply` a1
INNER JOIN `im_user_apply` a2
WHERE a1.id > a2.id
AND a1.uid = a2.uid
AND a1.target_id = a2.target_id
AND a1.apply_type = a2.apply_type;

-- ==================================================
-- 5. 添加缺失的外键约束（可选，可能影响性能）
-- ==================================================
-- 注意：外键约束会影响性能，在高并发场景下需要谨慎考虑

-- 为 im_message 表添加外键约束（可选）
-- ALTER TABLE `im_message`
-- ADD CONSTRAINT `fk_message_room` FOREIGN KEY (`room_id`) REFERENCES `im_room` (`id`) ON DELETE CASCADE,
-- ADD CONSTRAINT `fk_message_user` FOREIGN KEY (`from_uid`) REFERENCES `im_user` (`uid`) ON DELETE CASCADE;

-- 为 im_contact 表添加外键约束（可选）
-- ALTER TABLE `im_contact`
-- ADD CONSTRAINT `fk_contact_user` FOREIGN KEY (`uid`) REFERENCES `im_user` (`uid`) ON DELETE CASCADE,
-- ADD CONSTRAINT `fk_contact_room` FOREIGN KEY (`room_id`) REFERENCES `im_room` (`id`) ON DELETE CASCADE;

-- ==================================================
-- 6. 优化索引建议
-- ==================================================

-- 为 im_room 表添加索引以优化群组查询
CREATE INDEX IF NOT EXISTS `idx_room_type_create_time` ON `im_room` (`type`, `create_time`);

-- 为 im_user 表添加索引以优化用户搜索
CREATE INDEX IF NOT EXISTS `idx_user_nickname_create_time` ON `im_user` (`nickname`(50), `create_time`);

-- 为大表添加分区建议（当数据量超过1000万时考虑）
-- ALTER TABLE `im_message` PARTITION BY RANGE (TO_DAYS(create_time)) (
--     PARTITION p202512 VALUES LESS THAN (TO_DAYS('2026-01-01')),
--     PARTITION p202601 VALUES LESS THAN (TO_DAYS('2026-02-01')),
--     PARTITION p202602 VALUES LESS THAN (TO_DAYS('2026-03-01')),
--     PARTITION p_future VALUES LESS THAN MAXVALUE
-- );

-- ==================================================
-- 7. 数据完整性检查查询
-- ==================================================

-- 检查是否有孤立的消息（消息所属的房间不存在）
SELECT COUNT(*) as orphaned_messages
FROM `im_message` m
LEFT JOIN `im_room` r ON m.room_id = r.id
WHERE r.id IS NULL AND m.is_del = 0;

-- 检查是否有孤立的联系人（联系人所属的用户不存在）
SELECT COUNT(*) as orphaned_contacts
FROM `im_contact` c
LEFT JOIN `im_user` u ON c.uid = u.uid
WHERE u.uid IS NULL AND c.is_del = 0;

-- 检查是否有重复的未读消息记录
SELECT msg_id, uid, COUNT(*) as duplicate_count
FROM `im_message_read`
GROUP BY msg_id, uid
HAVING COUNT(*) > 1;

-- ==================================================
-- 执行完成提示
-- ==================================================
SELECT 'Database integrity fix script executed successfully!' as status;