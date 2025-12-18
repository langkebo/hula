package com.luohuo.flex.push.config;

import com.luohuo.flex.push.provider.apns.ApnsPushProvider;
import com.luohuo.flex.push.provider.fcm.FcmPushProvider;
import com.luohuo.flex.push.provider.hms.HmsPushProvider;
import com.luohuo.flex.push.provider.miui.MiuiPushProvider;
import com.luohuo.flex.push.provider.oppo.OppoPushProvider;
import com.luohuo.flex.push.provider.vivo.VivoPushProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 推送服务配置
 *
 * @author HuLa Team
 * @since 2025-01-01
 */
@Configuration
public class PushConfiguration {

    @Bean
    @ConditionalOnProperty(name = "hula.push.apns.enabled", havingValue = "true")
    public ApnsPushProvider apnsPushProvider() {
        return new ApnsPushProvider();
    }

    @Bean
    @ConditionalOnProperty(name = "hula.push.fcm.enabled", havingValue = "true")
    public FcmPushProvider fcmPushProvider() {
        return new FcmPushProvider();
    }

    @Bean
    @ConditionalOnProperty(name = "hula.push.hms.enabled", havingValue = "true")
    public HmsPushProvider hmsPushProvider() {
        return new HmsPushProvider();
    }

    @Bean
    @ConditionalOnProperty(name = "hula.push.miui.enabled", havingValue = "true")
    public MiuiPushProvider miuiPushProvider() {
        return new MiuiPushProvider();
    }

    @Bean
    @ConditionalOnProperty(name = "hula.push.oppo.enabled", havingValue = "true")
    public OppoPushProvider oppoPushProvider() {
        return new OppoPushProvider();
    }

    @Bean
    @ConditionalOnProperty(name = "hula.push.vivo.enabled", havingValue = "true")
    public VivoPushProvider vivoPushProvider() {
        return new VivoPushProvider();
    }
}