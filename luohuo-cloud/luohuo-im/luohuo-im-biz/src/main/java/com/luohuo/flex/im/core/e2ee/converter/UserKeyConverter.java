package com.luohuo.flex.im.core.e2ee.converter;

import com.luohuo.flex.im.domain.entity.UserPublicKey;
import com.luohuo.flex.im.domain.vo.UserPublicKeyVO;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * 用户密钥转换器
 * 用于在实体和VO之间进行转换
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Component
public class UserKeyConverter {

    /**
     * VO转实体
     */
    public UserPublicKey toEntity(UserPublicKeyVO vo) {
        if (vo == null) {
            return null;
        }

        UserPublicKey entity = new UserPublicKey();
        entity.setId(vo.getId());
        entity.setUserId(vo.getUserId());
        entity.setKeyId(vo.getKeyId());
        entity.setAlgorithm(vo.getAlgorithm());
        entity.setSpki(vo.getPublicKey() != null ? vo.getPublicKey() : vo.getSpki());
        entity.setFingerprint(vo.getFingerprint());
        entity.setCreateTime(vo.getCreateTime());
        entity.setExpiresAt(vo.getExpiresAt());
        entity.setTenantId(vo.getTenantId());

        return entity;
    }

    /**
     * 实体转VO
     */
    public UserPublicKeyVO toVO(UserPublicKey entity) {
        if (entity == null) {
            return null;
        }

        UserPublicKeyVO vo = new UserPublicKeyVO();
        vo.setId(entity.getId());
        vo.setUserId(entity.getUserId());
        vo.setKeyId(entity.getKeyId());
        vo.setAlgorithm(entity.getAlgorithm());
        vo.setSpki(entity.getSpki());
        vo.setPublicKey(entity.getSpki()); // 保持兼容性
        vo.setFingerprint(entity.getFingerprint());
        vo.setCreateTime(entity.getCreateTime());
        vo.setExpiresAt(entity.getExpiresAt());
        vo.setIsValid(entity.isValid());
        vo.setValid(entity.isValid());
        vo.setTenantId(entity.getTenantId());
        vo.setCreateBy(entity.getCreateBy() != null ? entity.getCreateBy().toString() : null);
        vo.setUpdateBy(entity.getUpdateBy() != null ? entity.getUpdateBy().toString() : null);
        vo.setUpdateTime(entity.getUpdateTime());

        return vo;
    }

    /**
     * 实体列表转VO列表
     */
    public List<UserPublicKeyVO> toVOList(List<UserPublicKey> entities) {
        if (entities == null) {
            return List.of();
        }
        return entities.stream()
                .map(this::toVO)
                .collect(Collectors.toList());
    }

    /**
     * VO列表转实体列表
     */
    public List<UserPublicKey> toEntityList(List<UserPublicKeyVO> vos) {
        if (vos == null) {
            return List.of();
        }
        return vos.stream()
                .map(this::toEntity)
                .collect(Collectors.toList());
    }
}