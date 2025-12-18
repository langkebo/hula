package com.luohuo.flex.base.crypto;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.luohuo.flex.base.entity.tenant.DefUser;
import com.luohuo.flex.base.service.tenant.DefUserService;
import com.luohuo.flex.crypto.PiiEncryptor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * PII数据迁移工具
 * ===== P0修复: 将明文PII数据加密 (2025-12-13) =====
 *
 * 功能:
 * - 批量加密现有的明文email、mobile、id_card数据
 * - 分页处理,避免OOM
 * - 幂等操作,已加密数据自动跳过
 * - 事务保护,失败自动回滚
 *
 * 启用方式:
 * 在application.yml中配置:
 * ```yaml
 * pii:
 *   migration:
 *     enabled: true  # 启用数据迁移 (生产环境运行一次后应设为false)
 *     batch-size: 1000  # 每批处理数量
 * ```
 *
 * 警告:
 * 1. 迁移前务必备份数据库！
 * 2. 生产环境建议在低峰期运行
 * 3. 运行一次后应禁用 (enabled: false)
 *
 * @author HuLa Security Team
 * @since 2025-12-13
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "pii.migration.enabled", havingValue = "true")
public class PiiDataMigration implements CommandLineRunner {

    @Autowired
    private DefUserService defUserService;

    @Autowired
    private PiiEncryptor piiEncryptor;

    /**
     * 每批处理的记录数
     */
    private static final int DEFAULT_BATCH_SIZE = 1000;

    @Override
    public void run(String... args) throws Exception {
        log.warn("==============================================");
        log.warn("PII数据迁移开始");
        log.warn("警告: 此操作将加密所有明文PII数据!");
        log.warn("==============================================");

        try {
            long startTime = System.currentTimeMillis();
            int totalMigrated = migrateAllUsers();
            long duration = System.currentTimeMillis() - startTime;

            log.info("==============================================");
            log.info("PII数据迁移完成!");
            log.info("总计迁移用户数: {}", totalMigrated);
            log.info("耗时: {} 秒", duration / 1000.0);
            log.info("==============================================");
            log.warn("建议: 迁移完成后, 请将配置 pii.migration.enabled 设为 false");

        } catch (Exception e) {
            log.error("PII数据迁移失败!", e);
            throw e;
        }
    }

    /**
     * 迁移所有用户数据
     *
     * @return 迁移的用户总数
     */
    private int migrateAllUsers() throws Exception {
        int totalMigrated = 0;
        int pageNum = 1;
        int pageSize = DEFAULT_BATCH_SIZE;

        while (true) {
            // 分页查询
            Page<DefUser> page = new Page<>(pageNum, pageSize);
            Page<DefUser> result = defUserService.page(page, new QueryWrapper<>());

            if (result.getRecords().isEmpty()) {
                break;  // 没有更多数据
            }

            // 批量处理当前页
            int migrated = migrateUserBatch(result.getRecords());
            totalMigrated += migrated;

            log.info("已处理第 {} 页, 本页 {} 条记录, 迁移 {} 条, 累计 {}",
                    pageNum, result.getRecords().size(), migrated, totalMigrated);

            pageNum++;

            if (pageNum > result.getPages()) {
                break;  // 已处理完所有页
            }
        }

        return totalMigrated;
    }

    /**
     * 迁移一批用户数据
     *
     * @param users 用户列表
     * @return 实际迁移的用户数
     */
    @Transactional(rollbackFor = Exception.class)
    public int migrateUserBatch(java.util.List<DefUser> users) throws Exception {
        int migrated = 0;

        for (DefUser user : users) {
            boolean needUpdate = false;

            // 1. 迁移email
            if (needsEncryption(user.getEmail())) {
                String encrypted = piiEncryptor.encrypt(user.getEmail());
                user.setEmail(encrypted);
                needUpdate = true;
            }

            // 2. 迁移mobile
            if (needsEncryption(user.getMobile())) {
                String encrypted = piiEncryptor.encrypt(user.getMobile());
                user.setMobile(encrypted);
                needUpdate = true;
            }

            // 3. 迁移id_card
            if (needsEncryption(user.getIdCard())) {
                String encrypted = piiEncryptor.encrypt(user.getIdCard());
                user.setIdCard(encrypted);
                needUpdate = true;
            }

            // 4. 更新数据库
            if (needUpdate) {
                defUserService.updateById(user);
                migrated++;
                log.debug("用户 {} (ID: {}) PII数据已加密", user.getUsername(), user.getId());
            }
        }

        return migrated;
    }

    /**
     * 判断字段是否需要加密
     * - 为空: 不需要加密
     * - 已加密(Base64格式): 不需要加密
     * - 明文: 需要加密
     *
     * @param value 字段值
     * @return true=需要加密, false=已加密或为空
     */
    private boolean needsEncryption(String value) {
        if (value == null || value.isEmpty()) {
            return false;  // 空值无需加密
        }

        // 检查是否已加密
        if (piiEncryptor.isEncrypted(value)) {
            return false;  // 已加密, 跳过
        }

        return true;  // 明文, 需要加密
    }
}
