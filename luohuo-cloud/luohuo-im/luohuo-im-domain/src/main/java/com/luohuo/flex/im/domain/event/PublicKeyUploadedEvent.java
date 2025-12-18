package com.luohuo.flex.im.domain.event;

import com.luohuo.flex.im.domain.entity.UserPublicKey;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * 公钥上传事件
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Getter
public class PublicKeyUploadedEvent extends ApplicationEvent {

    private final UserPublicKey publicKey;

    public PublicKeyUploadedEvent(UserPublicKey publicKey) {
        super(publicKey);
        this.publicKey = publicKey;
    }
}