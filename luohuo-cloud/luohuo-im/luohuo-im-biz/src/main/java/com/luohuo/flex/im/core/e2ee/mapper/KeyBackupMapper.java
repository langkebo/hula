package com.luohuo.flex.im.core.e2ee.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.luohuo.flex.im.domain.entity.KeyBackup;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 密钥备份Mapper接口
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Mapper
public interface KeyBackupMapper extends BaseMapper<KeyBackup> {

    /**
     * 根据用户ID和密钥ID查询备份
     */
    KeyBackup selectByUserIdAndKeyId(@Param("userId") Long userId,
                                    @Param("keyId") String keyId);

    /**
     * 查询用户的所有密钥备份
     */
    List<KeyBackup> selectByUserId(@Param("userId") Long userId);

    /**
     * 验证访问代码
     */
    int validateAccessCode(@Param("userId") Long userId,
                          @Param("keyId") String keyId,
                          @Param("accessCodeHash") String accessCodeHash);

    /**
     * 更新最后访问时间
     */
    int updateLastAccessed(@Param("userId") Long userId,
                          @Param("keyId") String keyId);

    /**
     * 更新备份状态
     */
    int updateStatus(@Param("userId") Long userId,
                    @Param("keyId") String keyId,
                    @Param("status") String status);
}